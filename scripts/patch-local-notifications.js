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
 * 5. Ensure ongoing timer notifications are sticky and unswipeable (FLAG_ONGOING_EVENT | FLAG_NO_CLEAR).
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

  // 3. Silence running timer channels completely (prevent ringing/vibration loops)
  const soundBlockAnchor = 'val soundUri = SoundResolver.resolveUri(context, localNotification.sound) ?: getDefaultSoundUrl(context)';
  if (content.includes(soundBlockAnchor) && !content.includes('/* LifeLog Silent Channel Guard */')) {
    const soundBlockRegex = /val soundUri = SoundResolver\.resolveUri\(context, localNotification\.sound\) \?: getDefaultSoundUrl\(context\)[\s\S]*?mBuilder\.setDefaults\(Notification\.DEFAULT_ALL\)\s*\}/;
    const silentReplacement = `/* LifeLog Silent Channel Guard */
        val isRunningTimer = localNotification.ongoing || (localNotification.channelId != null && localNotification.channelId.contains("running"))
        if (isRunningTimer || localNotification.sound == null) {
            mBuilder.setSound(null)
            mBuilder.setDefaults(0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                mBuilder.setNotificationSilent()
            }
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
    content = content.replace(soundBlockRegex, silentReplacement);
    modified = true;
  }

  // 4. Do NOT apply BigTextStyle if running timer (prevents overriding native progress bar)
  const bigTextAnchor = 'if (localNotification.largeBody != null) {';
  if (content.includes(bigTextAnchor)) {
    content = content.replace(
      'if (localNotification.largeBody != null) {',
      'if (localNotification.largeBody != null && (localNotification.channelId == null || !localNotification.channelId.contains("running"))) {'
    );
    modified = true;
  }

  // 5. Add native Android Progress Bar, Chronometer, and unswipeable Ongoing flags
  const progressHookMarker = '/* LifeLog Native Progress & Chronometer Hook v2 */';
  if (!content.includes(progressHookMarker)) {
    // Remove old marker if present
    content = content.replace(/\/\* LifeLog Native Progress & Chronometer Hook \*\/[\s\S]*?catch \(e: Exception\) \{\}/g, '');

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
                    val isCountDown = extraVal.optBoolean("chronometerCountDown", false)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        mBuilder.setChronometerCountDown(isCountDown)
                    }
                }
            }
            if (localNotification.ongoing) {
                mBuilder.setOngoing(true)
            }
        } catch (e: Exception) {}`;

      content = content.replace(targetAnchor, progressPatch);
      modified = true;
    }
  }

  // 6. Ensure unswipeable notification flags on build
  const buildAnchor = 'val buildNotification = mBuilder.build()';
  if (content.includes(buildAnchor) && !content.includes('/* LifeLog Sticky Flags */')) {
    const stickyFlags = `val buildNotification = mBuilder.build()
        /* LifeLog Sticky Flags */
        if (localNotification.ongoing) {
            buildNotification.flags = buildNotification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR
        }`;
    content = content.replace(buildAnchor, stickyFlags);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[LifeLog Patch] Successfully updated LocalNotificationManager.kt with silent channels, native progress, chronometer, and sticky ongoing flags.');
  } else {
    console.log('[LifeLog Patch] LocalNotificationManager.kt already contains all required patches.');
  }
} catch (err) {
  console.error('[LifeLog Patch] Error patching LocalNotificationManager.kt:', err);
}
