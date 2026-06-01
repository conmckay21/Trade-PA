import Foundation
import Capacitor

// Bridges JS -> the native Twilio CallKit/VoIP manager. The web layer calls
// register() once it has the user's Twilio access token (fetched with
// ?platform=ios so the token carries the VoIP push credential).
@objc(CallKitVoipPlugin)
public class CallKitVoipPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CallKitVoipPlugin"
    public let jsName = "CallKitVoip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setContacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveCall", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        // Bridge the native call lifecycle to JS so the web layer can show the
        // in-call screen and control the call (hang up / mute / speaker).
        TwilioCallManager.shared.eventSink = { [weak self] name, data in
            self?.notifyListeners(name, data: data)
        }
    }

    @objc func register(_ call: CAPPluginCall) {
        guard let accessToken = call.getString("accessToken"), !accessToken.isEmpty else {
            call.reject("Missing accessToken")
            return
        }
        TwilioCallManager.shared.register(accessToken: accessToken)
        call.resolve()
    }

    @objc func unregister(_ call: CAPPluginCall) {
        TwilioCallManager.shared.unregister()
        call.resolve()
    }

    // Receives the user's customers as a JSON string ([{number, name}, ...]) and
    // caches them on-device so incoming calls can show the caller's name.
    @objc func setContacts(_ call: CAPPluginCall) {
        let json = call.getString("json") ?? "[]"
        TwilioCallManager.shared.cacheContacts(json: json)
        call.resolve()
    }

    @objc func endCall(_ call: CAPPluginCall) {
        TwilioCallManager.shared.endActiveCallFromJS()
        call.resolve()
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        TwilioCallManager.shared.setMuted(call.getBool("muted") ?? false)
        call.resolve()
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        TwilioCallManager.shared.setSpeaker(call.getBool("on") ?? false)
        call.resolve()
    }

    @objc func getActiveCall(_ call: CAPPluginCall) {
        call.resolve(TwilioCallManager.shared.activeCallInfo())
    }
}
