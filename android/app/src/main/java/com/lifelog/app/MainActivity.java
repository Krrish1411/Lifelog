package com.lifelog.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Anti-theft: disable remote Chrome WebContents inspection in release builds
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
        }
    }
}
