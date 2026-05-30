#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift CallKitVoipPlugin with Capacitor at launch. Capacitor 7
// does not auto-discover this app-local Swift plugin from its CAPBridgedPlugin
// conformance alone, so this CAP_PLUGIN macro performs the registration
// explicitly. The selectors map to the @objc methods on the Swift class.
CAP_PLUGIN(CallKitVoipPlugin, "CallKitVoip",
    CAP_PLUGIN_METHOD(register, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(unregister, CAPPluginReturnPromise);
)
