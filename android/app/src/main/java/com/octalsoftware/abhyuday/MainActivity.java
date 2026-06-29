package com.octalsoftware.abhyuday;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must be called BEFORE super.onCreate() for the AndroidX SplashScreen API
        // to intercept the window and apply the custom theme on Android 12+.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
