package uk.co.tradespa.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Android counterpart of the iOS CallKitVoipPlugin. Same JS name ("CallKitVoip")
// and the same method + event contract, so the web layer (App.jsx) drives both
// platforms through one bridge. Incoming calls are delivered natively via FCM
// and the Twilio Voice Android SDK, so they ring even when the app is fully
// closed.
@CapacitorPlugin(name = "CallKitVoip")
public class CallKitVoipPlugin extends Plugin {

    @Override
    public void load() {
        // Forward the native call lifecycle to JS (callStarted / callEnded),
        // mirroring the iOS bridge.
        TwilioVoiceManager.getInstance(getContext().getApplicationContext())
            .setEventSink((name, data) -> notifyListeners(name, data));
    }

    @PluginMethod
    public void register(PluginCall call) {
        String accessToken = call.getString("accessToken");
        if (accessToken == null || accessToken.isEmpty()) {
            call.reject("Missing accessToken");
            return;
        }
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).register(accessToken);
        call.resolve();
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).unregister();
        call.resolve();
    }

    // Receives the user's customers as a JSON string ([{number, name}, ...]) and
    // caches them on-device so incoming calls can show the caller's name.
    @PluginMethod
    public void setContacts(PluginCall call) {
        String json = call.getString("json", "[]");
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).cacheContacts(json);
        call.resolve();
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).endActiveCallFromJS();
        call.resolve();
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        Boolean muted = call.getBoolean("muted", false);
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).setMuted(muted != null && muted);
        call.resolve();
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        Boolean on = call.getBoolean("on", false);
        TwilioVoiceManager.getInstance(getContext().getApplicationContext()).setSpeaker(on != null && on);
        call.resolve();
    }

    @PluginMethod
    public void getActiveCall(PluginCall call) {
        call.resolve(TwilioVoiceManager.getInstance(getContext().getApplicationContext()).activeCallInfo());
    }
}
