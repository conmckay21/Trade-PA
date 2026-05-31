import Foundation
import PushKit
import CallKit
import AVFoundation
import TwilioVoice

// Owns the native incoming-call path on iOS: PushKit (VoIP token + incoming
// pushes), CallKit (the system ringing UI), and the native Twilio Voice SDK
// (registration + answering). A singleton because PushKit must be set up at
// launch, before the web view exists, so calls ring even on a cold start.
final class TwilioCallManager: NSObject {

    static let shared = TwilioCallManager()

    private var voipRegistry: PKPushRegistry?
    private var provider: CXProvider?
    private let audioDevice = DefaultAudioDevice()

    private var voipDeviceToken: Data?
    private var accessToken: String?

    private var activeCallInvite: CallInvite?
    private var activeCall: Call?
    private var activeCallUUID: UUID?
    private var userInitiatedDisconnect = false
    private var incomingPushCompletion: (() -> Void)?

    private override init() {
        super.init()
    }

    // Called from AppDelegate.didFinishLaunching.
    func start() {
        TwilioVoiceSDK.audioDevice = audioDevice

        let config = CXProviderConfiguration(localizedName: "Trade PA")
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = false
        config.supportedHandleTypes = [.generic]
        let provider = CXProvider(configuration: config)
        provider.setDelegate(self, queue: nil)
        self.provider = provider

        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.voipRegistry = registry
    }

    // Called from JS (via the plugin) once the user's Twilio access token is known.
    func register(accessToken: String) {
        self.accessToken = accessToken
        guard let deviceToken = voipDeviceToken else {
            // PushKit has not handed us a VoIP token yet; we register on didUpdate.
            NSLog("[CallKitVoip] access token stored, waiting on VoIP token")
            return
        }
        TwilioVoiceSDK.register(accessToken: accessToken, deviceToken: deviceToken) { error in
            if let error = error {
                NSLog("[CallKitVoip] register failed: \(error.localizedDescription)")
            } else {
                NSLog("[CallKitVoip] registered for incoming calls")
            }
        }
    }

    func unregister() {
        guard let accessToken = accessToken, let deviceToken = voipDeviceToken else { return }
        TwilioVoiceSDK.unregister(accessToken: accessToken, deviceToken: deviceToken) { error in
            if let error = error {
                NSLog("[CallKitVoip] unregister failed: \(error.localizedDescription)")
            }
        }
    }

    private func endActiveCall() {
        activeCall = nil
        activeCallInvite = nil
        activeCallUUID = nil
        userInitiatedDisconnect = false
        audioDevice.isEnabled = false
    }

    // Local cache of {last-9-digits of phone -> customer name}, written by the
    // web layer via CallKitVoip.setContacts. Lets the incoming-call UI show the
    // customer's name even on a cold start, when no network or DB is available.
    // Last 9 digits so +44 / 0 prefixes still match.
    private static let contactsKey = "tradepa_call_contacts"

    func cacheContacts(json: String) {
        guard let data = json.data(using: .utf8),
              let arr = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return }
        var map: [String: String] = [:]
        for item in arr {
            guard let number = item["number"] as? String,
                  let name = item["name"] as? String, !name.isEmpty else { continue }
            let digits = number.filter { $0.isNumber }
            guard digits.count >= 7 else { continue }
            map[String(digits.suffix(9))] = name
        }
        UserDefaults.standard.set(map, forKey: TwilioCallManager.contactsKey)
    }

    static func resolveName(forNumber raw: String) -> String? {
        let digits = raw.filter { $0.isNumber }
        guard digits.count >= 7 else { return nil }
        let key = String(digits.suffix(9))
        let map = (UserDefaults.standard.dictionary(forKey: contactsKey) as? [String: String]) ?? [:]
        return map[key]
    }
}

// MARK: - PushKit
extension TwilioCallManager: PKPushRegistryDelegate {

    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        voipDeviceToken = pushCredentials.token
        NSLog("[CallKitVoip] VoIP token received (\(pushCredentials.token.count) bytes)")
        if let accessToken = accessToken {
            register(accessToken: accessToken)
        }
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        unregister()
        voipDeviceToken = nil
    }

    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        guard type == .voIP else { completion(); return }
        // iOS 13+ requires reporting a call to CallKit before completion() fires.
        // Twilio invokes our NotificationDelegate synchronously; we fire completion
        // once the call has been reported (in callInviteReceived / cancelled).
        incomingPushCompletion = completion
        TwilioVoiceSDK.handleNotification(payload.dictionaryPayload, delegate: self, delegateQueue: nil)
    }
}

// MARK: - Twilio incoming-call notifications
extension TwilioCallManager: NotificationDelegate {

    func callInviteReceived(callInvite: CallInvite) {
        activeCallInvite = callInvite
        activeCallUUID = callInvite.uuid

        let rawFrom = (callInvite.from ?? "")
            .replacingOccurrences(of: "client:", with: "")
        let resolvedName = TwilioCallManager.resolveName(forNumber: rawFrom)
        let handleValue = rawFrom.isEmpty ? "Unknown caller" : rawFrom
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handleValue)
        update.localizedCallerName = resolvedName ?? handleValue
        update.hasVideo = false

        audioDevice.isEnabled = false
        provider?.reportNewIncomingCall(with: callInvite.uuid, update: update) { [weak self] error in
            if let error = error {
                NSLog("[CallKitVoip] reportNewIncomingCall failed: \(error.localizedDescription)")
            } else {
                NSLog("[CallKitVoip] incoming call reported to CallKit")
            }
            self?.incomingPushCompletion?()
            self?.incomingPushCompletion = nil
        }
    }

    func cancelledCallInviteReceived(cancelledCallInvite: CancelledCallInvite, error: Error) {
        if let uuid = activeCallUUID {
            provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        endActiveCall()
        incomingPushCompletion?()
        incomingPushCompletion = nil
    }
}

// MARK: - Twilio call lifecycle
extension TwilioCallManager: CallDelegate {

    func callDidConnect(call: Call) {
        NSLog("[CallKitVoip] call connected")
    }

    func callDidDisconnect(call: Call, error: Error?) {
        if !userInitiatedDisconnect, let uuid = activeCallUUID {
            provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
        endActiveCall()
    }

    func callDidFailToConnect(call: Call, error: Error) {
        NSLog("[CallKitVoip] call failed: \(error.localizedDescription)")
        if let uuid = activeCallUUID {
            provider?.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        }
        endActiveCall()
    }
}

// MARK: - CallKit
extension TwilioCallManager: CXProviderDelegate {

    func providerDidReset(_ provider: CXProvider) {
        audioDevice.isEnabled = false
        activeCall?.disconnect()
        endActiveCall()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        audioDevice.isEnabled = true
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        audioDevice.isEnabled = false
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let callInvite = activeCallInvite else {
            action.fail()
            return
        }
        audioDevice.isEnabled = false
        let options = AcceptOptions(callInvite: callInvite) { _ in }
        let call = callInvite.accept(options: options, delegate: self)
        activeCall = call
        activeCallInvite = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        if let call = activeCall {
            userInitiatedDisconnect = true
            call.disconnect()
        } else if let invite = activeCallInvite {
            invite.reject()
            activeCallInvite = nil
        }
        action.fulfill()
    }
}
