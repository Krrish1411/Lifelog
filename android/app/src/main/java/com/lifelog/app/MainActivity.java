package com.lifelog.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Anti-theft: disable remote Chrome WebContents inspection in release builds
        try {
            boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            if (!isDebuggable) {
                WebView.setWebContentsDebuggingEnabled(false);
            }
        } catch (Exception ignored) {}
    }
}
