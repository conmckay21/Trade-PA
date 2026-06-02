package uk.co.tradespa.app;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.twilio.voice.CallException;
import com.twilio.voice.CallInvite;
import com.twilio.voice.CancelledCallInvite;
import com.twilio.voice.MessageListener;
import com.twilio.voice.Voice;

import java.util.Map;

// Single FirebaseMessagingService for the app. Android only allows one, and the
// Capacitor push plugin already ships one, so we extend it: Twilio call invites
// are handled here and everything else is delegated to the Capacitor handler via
// super, keeping existing push notifications working.
public class VoiceFirebaseMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            boolean handled = Voice.handleMessage(getApplicationContext(), data, messageListener);
            if (handled) {
                return;
            }
        }
        // Not a Twilio call message: let the Capacitor push plugin handle it.
        super.onMessageReceived(remoteMessage);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // Keep Capacitor push registration working, then refresh Twilio's copy.
        super.onNewToken(token);
        TwilioVoiceManager.getInstance(getApplicationContext()).onFcmTokenRefreshed(token);
    }

    private final MessageListener messageListener = new MessageListener() {
        @Override
        public void onCallInvite(@NonNull CallInvite callInvite) {
            TwilioVoiceManager.getInstance(getApplicationContext())
                .onIncomingCallInvite(getApplicationContext(), callInvite);
        }

        @Override
        public void onCancelledCallInvite(@NonNull CancelledCallInvite cancelledCallInvite,
                                          @Nullable CallException callException) {
            TwilioVoiceManager.getInstance(getApplicationContext())
                .onCancelledCallInvite(getApplicationContext(), cancelledCallInvite);
        }
    };
}
