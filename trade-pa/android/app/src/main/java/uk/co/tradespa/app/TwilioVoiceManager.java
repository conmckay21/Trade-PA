package uk.co.tradespa.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.google.firebase.messaging.FirebaseMessaging;
import com.twilio.voice.Call;
import com.twilio.voice.CallException;
import com.twilio.voice.CallInvite;
import com.twilio.voice.CancelledCallInvite;
import com.twilio.voice.RegistrationException;
import com.twilio.voice.RegistrationListener;
import com.twilio.voice.UnregistrationListener;
import com.twilio.voice.Voice;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Set;

// Central native call manager for Android. Holds the live Twilio call, presents
// the closed-app incoming-call notification, and forwards the call lifecycle to
// JS through an EventSink set by CallKitVoipPlugin. This mirrors the iOS
// TwilioCallManager + CallKitVoipPlugin pairing so App.jsx can drive both
// platforms through the same "CallKitVoip" bridge.
public class TwilioVoiceManager {

    public interface EventSink {
        void emit(String name, JSObject data);
    }

    public static final String ACTION_ANSWER = "uk.co.tradespa.app.ANSWER_CALL";
    public static final String ACTION_DECLINE = "uk.co.tradespa.app.DECLINE_CALL";
    public static final String ACTION_CALL_ENDED = "uk.co.tradespa.app.CALL_ENDED";
    public static final String EXTRA_CALLER_NAME = "caller_name";
    public static final String EXTRA_CALLER_NUMBER = "caller_number";

    private static final String CHANNEL_ID = "tradepa_incoming_calls";
    private static final int NOTIFICATION_ID = 4711;
    private static final String CONTACTS_PREF = "tradepa_call_contacts";

    private static TwilioVoiceManager instance;

    private final Context appContext;
    private EventSink eventSink;

    private String accessToken;
    private String fcmToken;

    private CallInvite pendingInvite;
    private Call activeCall;
    private long activeCallStart;
    private String activeCallerName;
    private String activeCallerNumber;

    private TwilioVoiceManager(Context context) {
        this.appContext = context.getApplicationContext();
        createChannel();
    }

    public static synchronized TwilioVoiceManager getInstance(Context context) {
        if (instance == null) {
            instance = new TwilioVoiceManager(context);
        }
        return instance;
    }

    public void setEventSink(EventSink sink) {
        this.eventSink = sink;
    }

    private void emit(String name, JSObject data) {
        EventSink sink = this.eventSink;
        if (sink != null) {
            sink.emit(name, data);
        }
    }

    // Registration. Fetch the current FCM token, then register it with Twilio so
    // call invites are delivered as data messages even when the app is closed.
    public void register(final String accessToken) {
        this.accessToken = accessToken;
        FirebaseMessaging.getInstance().getToken()
            .addOnSuccessListener(token -> {
                fcmToken = token;
                try {
                    Voice.register(accessToken, Voice.RegistrationChannel.FCM, token, registrationListener);
                } catch (Exception e) {
                    android.util.Log.w("TradePAVoice", "register error: " + e.getMessage());
                }
            })
            .addOnFailureListener(e ->
                android.util.Log.w("TradePAVoice", "FCM token error: " + e.getMessage()));
    }

    public void unregister() {
        if (accessToken == null || fcmToken == null) return;
        try {
            Voice.unregister(accessToken, Voice.RegistrationChannel.FCM, fcmToken, unregistrationListener);
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "unregister error: " + e.getMessage());
        }
    }

    // Called by VoiceFirebaseMessagingService when FCM rotates the token.
    public void onFcmTokenRefreshed(String token) {
        fcmToken = token;
        if (accessToken != null) {
            try {
                Voice.register(accessToken, Voice.RegistrationChannel.FCM, token, registrationListener);
            } catch (Exception e) {
                android.util.Log.w("TradePAVoice", "re-register error: " + e.getMessage());
            }
        }
    }

    // Incoming invite arrived (possibly with the app fully closed). Resolve the
    // caller's name from the cached contacts and raise a full-screen notification.
    public void onIncomingCallInvite(Context context, CallInvite invite) {
        pendingInvite = invite;
        activeCallerNumber = invite.getFrom() != null ? invite.getFrom() : "";
        activeCallerName = resolveName(activeCallerNumber);
        showIncomingNotification(context.getApplicationContext());
    }

    public void onCancelledCallInvite(Context context, CancelledCallInvite invite) {
        pendingInvite = null;
        clearNotification(context.getApplicationContext());
        broadcastCallEnded(context.getApplicationContext());
    }

    public void acceptCall(Context context) {
        Context ctx = context.getApplicationContext();
        if (pendingInvite == null) return;
        try {
            activeCall = pendingInvite.accept(ctx, callListener);
            pendingInvite = null;
            clearNotification(ctx);
            configureAudioForCall();
            bringAppToFront(ctx);
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "accept error: " + e.getMessage());
        }
    }

    public void rejectCall(Context context) {
        Context ctx = context.getApplicationContext();
        if (pendingInvite != null) {
            try {
                pendingInvite.reject(ctx);
            } catch (Exception e) {
                android.util.Log.w("TradePAVoice", "reject error: " + e.getMessage());
            }
            pendingInvite = null;
        }
        clearNotification(ctx);
        broadcastCallEnded(ctx);
    }

    // Hang up driven from the in-app call screen (JS endCall()).
    public void endActiveCallFromJS() {
        if (activeCall != null) {
            try {
                activeCall.disconnect();
            } catch (Exception e) {
                android.util.Log.w("TradePAVoice", "disconnect error: " + e.getMessage());
            }
        }
    }

    public void setMuted(boolean muted) {
        if (activeCall != null) {
            try {
                activeCall.mute(muted);
            } catch (Exception e) {
                android.util.Log.w("TradePAVoice", "mute error: " + e.getMessage());
            }
        }
    }

    public void setSpeaker(boolean on) {
        try {
            AudioManager am = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                am.setSpeakerphoneOn(on);
            }
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "speaker error: " + e.getMessage());
        }
    }

    // Cold-start snapshot for JS getActiveCall(): true between onConnected and
    // onDisconnected even if the webview attached its listeners late.
    public JSObject activeCallInfo() {
        JSObject obj = new JSObject();
        boolean active = activeCall != null && activeCallStart > 0;
        obj.put("active", active);
        if (active) {
            obj.put("callerName", activeCallerName != null ? activeCallerName : "");
            obj.put("callerNumber", activeCallerNumber != null ? activeCallerNumber : "");
            obj.put("startTime", activeCallStart);
        }
        return obj;
    }

    // Contact cache. Store a map of the last 9 digits of each number to a name so
    // UK numbers match regardless of +44 / 0 prefixing, matching the iOS cache.
    public void cacheContacts(String json) {
        try {
            SharedPreferences prefs = appContext.getSharedPreferences(CONTACTS_PREF, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.clear();
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject c = arr.optJSONObject(i);
                if (c == null) continue;
                String number = c.optString("number", "");
                String name = c.optString("name", "");
                String key = lastNineDigits(number);
                if (!key.isEmpty() && !name.isEmpty()) {
                    editor.putString(key, name);
                }
            }
            editor.apply();
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "cacheContacts error: " + e.getMessage());
        }
    }

    private String resolveName(String number) {
        String key = lastNineDigits(number);
        if (key.isEmpty()) return "Unknown caller";
        SharedPreferences prefs = appContext.getSharedPreferences(CONTACTS_PREF, Context.MODE_PRIVATE);
        return prefs.getString(key, "Unknown caller");
    }

    private String lastNineDigits(String number) {
        if (number == null) return "";
        String digits = number.replaceAll("[^0-9]", "");
        if (digits.length() <= 9) return digits;
        return digits.substring(Math.max(0, digits.length() - 9));
    }

    private final RegistrationListener registrationListener = new RegistrationListener() {
        @Override
        public void onRegistered(@NonNull String accessToken, @NonNull String fcmToken) {
            android.util.Log.d("TradePAVoice", "registered for incoming calls");
        }

        @Override
        public void onError(@NonNull RegistrationException registrationException,
                            @NonNull String accessToken,
                            @NonNull String fcmToken) {
            android.util.Log.w("TradePAVoice", "registration failed: " + registrationException.getMessage());
        }
    };

    private final UnregistrationListener unregistrationListener = new UnregistrationListener() {
        @Override
        public void onUnregistered(@Nullable String accessToken, @Nullable String fcmToken) {
            android.util.Log.d("TradePAVoice", "unregistered");
        }

        @Override
        public void onError(@NonNull RegistrationException error,
                            @NonNull String accessToken,
                            @NonNull String fcmToken) {
            android.util.Log.w("TradePAVoice", "unregister failed: " + error.getMessage());
        }
    };

    private final Call.Listener callListener = new Call.Listener() {
        @Override
        public void onRinging(@NonNull Call call) {
        }

        @Override
        public void onConnectFailure(@NonNull Call call, @NonNull CallException callException) {
            android.util.Log.w("TradePAVoice", "connect failure: " + callException.getMessage());
            finishCall();
        }

        @Override
        public void onConnected(@NonNull Call call) {
            activeCall = call;
            activeCallStart = System.currentTimeMillis();
            JSObject info = new JSObject();
            info.put("startTime", activeCallStart);
            info.put("callerName", activeCallerName != null ? activeCallerName : "Unknown caller");
            info.put("callerNumber", activeCallerNumber != null ? activeCallerNumber : "");
            emit("callStarted", info);
        }

        @Override
        public void onReconnecting(@NonNull Call call, @NonNull CallException callException) {
        }

        @Override
        public void onReconnected(@NonNull Call call) {
        }

        @Override
        public void onDisconnected(@NonNull Call call, @Nullable CallException callException) {
            finishCall();
        }

        @Override
        public void onCallQualityWarningsChanged(@NonNull Call call,
                                                 @NonNull Set<Call.CallQualityWarning> currentWarnings,
                                                 @NonNull Set<Call.CallQualityWarning> previousWarnings) {
        }
    };

    private void finishCall() {
        activeCall = null;
        activeCallStart = 0;
        activeCallerName = null;
        activeCallerNumber = null;
        resetAudio();
        emit("callEnded", new JSObject());
        broadcastCallEnded(appContext);
    }

    private void configureAudioForCall() {
        try {
            AudioManager am = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                am.setSpeakerphoneOn(false);
            }
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "audio config error: " + e.getMessage());
        }
    }

    private void resetAudio() {
        try {
            AudioManager am = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                am.setSpeakerphoneOn(false);
                am.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "audio reset error: " + e.getMessage());
        }
    }

    private void bringAppToFront(Context context) {
        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(launch);
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "bring to front error: " + e.getMessage());
        }
    }

    private void broadcastCallEnded(Context context) {
        try {
            Intent intent = new Intent(ACTION_CALL_ENDED);
            intent.setPackage(context.getPackageName());
            context.sendBroadcast(intent);
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "broadcast error: " + e.getMessage());
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Incoming Trade PA calls");
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(channel);
        }
    }

    private void showIncomingNotification(Context context) {
        String name = activeCallerName != null ? activeCallerName : "Unknown caller";
        String number = activeCallerNumber != null ? activeCallerNumber : "";

        Intent fullScreen = new Intent(context, IncomingCallActivity.class);
        fullScreen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreen.putExtra(EXTRA_CALLER_NAME, name);
        fullScreen.putExtra(EXTRA_CALLER_NUMBER, number);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
            context, 1001, fullScreen, pendingFlags());

        Intent answer = new Intent(context, CallActionReceiver.class);
        answer.setAction(ACTION_ANSWER);
        PendingIntent answerPi = PendingIntent.getBroadcast(context, 1002, answer, pendingFlags());

        Intent decline = new Intent(context, CallActionReceiver.class);
        decline.setAction(ACTION_DECLINE);
        PendingIntent declinePi = PendingIntent.getBroadcast(context, 1003, decline, pendingFlags());

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(name)
            .setContentText(number.isEmpty() ? "Incoming call" : number)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPi, true)
            .addAction(android.R.drawable.sym_action_call, "Answer", answerPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePi);

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            android.util.Log.w("TradePAVoice", "notify denied: " + e.getMessage());
        }
    }

    private void clearNotification(Context context) {
        try {
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
        } catch (Exception e) {
            android.util.Log.w("TradePAVoice", "cancel error: " + e.getMessage());
        }
    }

    private int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
