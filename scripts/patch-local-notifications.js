#!/usr/bin/env node

/**
 * scripts/patch-local-notifications.js
 *
 * Patches @capacitor/local-notifications on Android to:
 * 1. Set NotificationCompat.VISIBILITY_PUBLIC so timer notifications and buttons
 *    are fully visible on the lock screen even when OS "Hide sensitive content" is active.
 * 2. Prevent premature notification dismissal when "Pause" or "Resume" actions are tapped,
 *    keeping the notification sticky in the notification shade with updated state.
 * 3. Support native Android Progress Bar (mBuilder.setProgress) and Chronometer countdown
 *    via localNotification.extra parameters for a sleek, modern system timer display.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(
  __dirname,
  '../node_modules/@capacitor/local-notifications/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.kt'
);

if (!fs.existsSync(targetFile)) {
  console.log('[LifeLog Patch] Target LocalNotificationManager.kt not found (skipping patch).');
  process.exit(0);
}

try {
  let content = fs.readFileSync(targetFile, 'utf8');
  let modified = false;

  // 1. Ensure VISIBILITY_PUBLIC and setOnlyAlertOnce
  if (!content.includes('mBuilder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)')) {
    if (content.includes('mBuilder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)')) {
      content = content.replace(
        'mBuilder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)',
        'mBuilder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)'
      );
      modified = true;
    } else if (content.includes('val mBuilder = NotificationCompat.Builder')) {
      content = content.replace(
        'val mBuilder = NotificationCompat.Builder(context, channelId)',
        'val mBuilder = NotificationCompat.Builder(context, channelId)\n            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)'
      );
      modified = true;
    }
  }

  // 2. Prevent dismissing notification when user taps Pause or Resume action buttons
  const oldDismissPattern = 'val menuAction = data.getStringExtra(ACTION_INTENT_KEY)\n\n        dismissVisibleNotification(notificationId)';
  const newDismissPattern = 'val menuAction = data.getStringExtra(ACTION_INTENT_KEY)\n\n        if (menuAction != "action_pause" && menuAction != "action_resume") {\n            dismissVisibleNotification(notificationId)\n        }';
  if (content.includes(oldDismissPattern)) {
    content = content.replace(oldDismissPattern, newDismissPattern);
    modified = true;
    console.log('[LifeLog Patch] Patched action handling to prevent dismissing notification on Pause/Resume.');
  }

  // 3. Add native Android Progress Bar and Chronometer support via localNotification.extra
  const progressHookMarker = '/* LifeLog Native Progress & Chronometer Hook */';
  if (!content.includes(progressHookMarker)) {
    const targetAnchor = 'mBuilder.setOnlyAlertOnce(true)';
    if (content.includes(targetAnchor)) {
      const progressPatch = `${targetAnchor}
        ${progressHookMarker}
        try {
            val extraVal = localNotification.extra
            if (extraVal is JSONObject) {
                if (extraVal.has("maxProgress") && extraVal.has("progress")) {
                    val maxP = extraVal.getInt("maxProgress")
                    val curP = extraVal.getInt("progress")
                    mBuilder.setProgress(maxP, curP, false)
                }
                if (extraVal.optBoolean("usesChronometer", false)) {
                    val base = extraVal.optLong("chronometerBase", System.currentTimeMillis())
                    mBuilder.setUsesChronometer(true)
                    mBuilder.setWhen(base)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && extraVal.optBoolean("chronometerCountDown", false)) {
                        mBuilder.setChronometerCountDown(true)
                    }
                }
            }
        } catch (e: Exception) {}`;

      content = content.replace(targetAnchor, progressPatch);
      modified = true;
      console.log('[LifeLog Patch] Added native progress bar and chronometer countdown support.');
    }
  }

  if (modified) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[LifeLog Patch] Successfully updated LocalNotificationManager.kt.');
  } else {
    console.log('[LifeLog Patch] LocalNotificationManager.kt already contains all required patches.');
  }
} catch (err) {
  console.error('[LifeLog Patch] Error patching LocalNotificationManager.kt:', err);
}
