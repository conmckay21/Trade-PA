package uk.co.tradespa.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Handles the Answer / Decline buttons on the incoming-call notification.
public class CallActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        Context appCtx = context.getApplicationContext();
        TwilioVoiceManager manager = TwilioVoiceManager.getInstance(appCtx);
        String action = intent.getAction();
        if (TwilioVoiceManager.ACTION_ANSWER.equals(action)) {
            manager.acceptCall(appCtx);
        } else if (TwilioVoiceManager.ACTION_DECLINE.equals(action)) {
            manager.rejectCall(appCtx);
        }
    }
}
