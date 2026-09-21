#!/usr/bin/env node

/**
 * scripts/patch-local-notifications.js
 *
 * Patches @capacitor/local-notifications to set NotificationCompat.VISIBILITY_PUBLIC
 * on Android. This ensures that focus session notifications, progress bars, and
 * action buttons remain visible on the lock screen even when Android OS has
 * "Hide sensitive content" enabled.
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

  if (content.includes('mBuilder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)')) {
    console.log('[LifeLog Patch] LocalNotificationManager.kt already patched with VISIBILITY_PUBLIC.');
    process.exit(0);
  }

  if (content.includes('mBuilder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)')) {
    content = content.replace(
      'mBuilder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)',
      'mBuilder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)'
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[LifeLog Patch] Successfully patched LocalNotificationManager.kt with VISIBILITY_PUBLIC.');
  } else {
    console.warn('[LifeLog Patch] Warning: Could not locate setVisibility call in LocalNotificationManager.kt');
  }
} catch (err) {
  console.error('[LifeLog Patch] Error patching LocalNotificationManager.kt:', err);
}
