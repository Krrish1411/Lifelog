#!/usr/bin/env node

/**
 * scripts/patch-local-notifications.js
 *
 * Patches @capacitor/local-notifications on Android to:
 * 1. Set NotificationCompat.VISIBILITY_PUBLIC so timer notifications and buttons
 *    are fully visible on the lock screen even when OS "Hide sensitive content" is active.
 * 2. Prevent premature notification dismissal when "Pause" or "Resume" actions are tapped.
 * 3. Enforce 100% silent updates (no repetitive chime or vibration loops) on running timer channels.
 * 4. Support native Android Progress Bar (mBuilder.setProgress) and Chronometer count-up / count-down.
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

  // 1. Ensure VISIBILITY_PUBLIC
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
  }

  // 3. Clean up any previous sticky flags patch
  if (content.includes('/* LifeLog Sticky Flags */')) {
    content = content.replace(/\/\* LifeLog Sticky Flags \*\/[\s\S]*?buildNotification\.flags or Notification\.FLAG_ONGOING_EVENT or Notification\.FLAG_NO_CLEAR\s*\}/g, '');
    modified = true;
  }

  // 4. Silence running timer channels completely (prevent ringing/vibration loops)
  const silentPatchMarker = '/* LifeLog Silent Channel Guard v2 */';
  const silentReplacement = `${silentPatchMarker}
        val chId = localNotification.channelId
        val isRunningTimer = localNotification.ongoing || (chId != null && chId.contains("running"))
        if (isRunningTimer || localNotification.sound == null) {
            mBuilder.setSound(null)
            mBuilder.setDefaults(0)
            mBuilder.setVibrate(null)
        } else {
            val soundUri = SoundResolver.resolveUri(context, localNotification.sound) ?: getDefaultSoundUrl(context)
            if (soundUri != null) {
                context.grantUriPermission("com.android.systemui", soundUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                mBuilder.setSound(soundUri)
                mBuilder.setDefaults(Notification.DEFAULT_VIBRATE or Notification.DEFAULT_LIGHTS)
            } else {
                mBuilder.setDefaults(Notification.DEFAULT_ALL)
            }
        }`;

  if (content.includes('/* LifeLog Silent Channel Guard */')) {
    const oldSilentRegex = /\/\* LifeLog Silent Channel Guard \*\/[\s\S]*?mBuilder\.setDefaults\(Notification\.DEFAULT_ALL\)\s*\}\s*\}/;
    content = content.replace(oldSilentRegex, silentReplacement);
    modified = true;
  } else if (!content.includes(silentPatchMarker)) {
    const soundBlockRegex = /val soundUri = SoundResolver\.resolveUri\(context, localNotification\.sound\) \?: getDefaultSoundUrl\(context\)[\s\S]*?mBuilder\.setDefaults\(Notification\.DEFAULT_ALL\)\s*\}/;
    if (soundBlockRegex.test(content)) {
      content = content.replace(soundBlockRegex, silentReplacement);
      modified = true;
    }
  }

  // 5. Do NOT apply BigTextStyle if running timer (prevents overriding native progress bar)
  if (content.includes('if (localNotification.largeBody != null && (localNotification.channelId == null || !localNotification.channelId.contains("running"))) {')) {
    content = content.replace(
      'if (localNotification.largeBody != null && (localNotification.channelId == null || !localNotification.channelId.contains("running"))) {',
      'val chIdForBigText = localNotification.channelId\n        if (localNotification.largeBody != null && (chIdForBigText == null || !chIdForBigText.contains("running"))) {'
    );
    modified = true;
  } else if (content.includes('if (localNotification.largeBody != null) {') && !content.includes('chIdForBigText')) {
    content = content.replace(
      'if (localNotification.largeBody != null) {',
      'val chIdForBigText = localNotification.channelId\n        if (localNotification.largeBody != null && (chIdForBigText == null || !chIdForBigText.contains("running"))) {'
    );
    modified = true;
  }

  // 6. Native Progress and Chronometer
  const progressHookMarker = '/* LifeLog Native Progress & Chronometer Hook v3 */';
  const progressPatchCode = `${progressHookMarker}
        try {
            val extraVal = localNotification.extra
            val extraJson = when (extraVal) {
                is JSONObject -> extraVal
                is String -> try { JSONObject(extraVal) } catch (e: Exception) { null }
                else -> null
            }
            if (extraJson != null) {
                if (extraJson.has("maxProgress") && extraJson.has("progress")) {
                    val maxP = extraJson.optInt("maxProgress", 100)
                    val curP = extraJson.optInt("progress", 0)
                    mBuilder.setProgress(maxP, curP, false)
                }
                if (extraJson.optBoolean("usesChronometer", false)) {
                    val base = extraJson.optLong("chronometerBase", System.currentTimeMillis())
                    mBuilder.setUsesChronometer(true)
                    mBuilder.setWhen(base)
                    val isCountDown = extraJson.optBoolean("chronometerCountDown", false)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        mBuilder.extras.putBoolean("android.chronometerCountDown", isCountDown)
                    }
                }
            }
            if (localNotification.ongoing) {
                mBuilder.setOngoing(true)
            }
        } catch (e: Exception) {}`;

  if (content.includes('/* LifeLog Native Progress & Chronometer Hook v2 */') || content.includes('/* LifeLog Native Progress & Chronometer Hook */')) {
    const oldHookRegex = /\/\* LifeLog Native Progress & Chronometer Hook(?: v2)? \*\/[\s\S]*?catch \(e: Exception\) \{\}/;
    content = content.replace(oldHookRegex, progressPatchCode);
    modified = true;
  } else if (!content.includes(progressHookMarker)) {
    const targetAnchor = 'mBuilder.setOnlyAlertOnce(true)';
    if (content.includes(targetAnchor)) {
      content = content.replace(targetAnchor, `${targetAnchor}\n        ${progressPatchCode}`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[LifeLog Patch] Successfully updated LocalNotificationManager.kt with silent channels, safe smart casts, and native progress.');
  } else {
    console.log('[LifeLog Patch] LocalNotificationManager.kt already contains all required patches.');
  }
} catch (err) {
  console.error('[LifeLog Patch] Error patching LocalNotificationManager.kt:', err);
}
