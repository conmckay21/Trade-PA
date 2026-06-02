package uk.co.tradespa.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the native call bridge before Capacitor boots its plugins.
        registerPlugin(CallKitVoipPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
