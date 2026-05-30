import UIKit
import Capacitor

// Capacitor 7 was not picking up the app-local CallKitVoip plugin from its
// CAPBridgedPlugin conformance, so register it explicitly. capacitorDidLoad
// runs once the bridge is ready, before the web layer calls into the plugin.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CallKitVoipPlugin())
    }
}
