package uk.co.tradespa.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

// Full-screen incoming-call screen launched by the full-screen-intent
// notification. Shows over the lockscreen and wakes the device so a closed-app
// call rings like a normal phone call. Answer / Decline delegate to the manager.
public class IncomingCallActivity extends Activity {

    private BroadcastReceiver endReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockscreen();
        setContentView(R.layout.activity_incoming_call);

        String name = getIntent().getStringExtra(TwilioVoiceManager.EXTRA_CALLER_NAME);
        String number = getIntent().getStringExtra(TwilioVoiceManager.EXTRA_CALLER_NUMBER);

        TextView nameView = findViewById(R.id.caller_name);
        TextView numberView = findViewById(R.id.caller_number);
        nameView.setText(name != null && !name.isEmpty() ? name : "Unknown caller");
        numberView.setText(number != null ? number : "");

        Button answer = findViewById(R.id.answer_button);
        Button decline = findViewById(R.id.decline_button);
        answer.setOnClickListener(v -> {
            TwilioVoiceManager.getInstance(getApplicationContext()).acceptCall(getApplicationContext());
            finish();
        });
        decline.setOnClickListener(v -> {
            TwilioVoiceManager.getInstance(getApplicationContext()).rejectCall(getApplicationContext());
            finish();
        });

        endReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                finish();
            }
        };
        IntentFilter filter = new IntentFilter(TwilioVoiceManager.ACTION_CALL_ENDED);
        ContextCompat.registerReceiver(this, endReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void showOverLockscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    @Override
    protected void onDestroy() {
        if (endReceiver != null) {
            try {
                unregisterReceiver(endReceiver);
            } catch (Exception ignored) {
            }
            endReceiver = null;
        }
        super.onDestroy();
    }
}
