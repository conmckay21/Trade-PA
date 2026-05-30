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
    ]

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
}
