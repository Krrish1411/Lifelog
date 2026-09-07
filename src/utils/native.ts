import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = Capacitor.isNativePlatform();

/**
 * Tactile physical haptics for Android and mobile.
 * Falls back seamlessly to navigator.vibrate on mobile browsers.
 */
export async function triggerHaptic(
  type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light"
): Promise<void> {
  try {
    if (isNative) {
      if (type === "light") {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (type === "medium") {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (type === "heavy") {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (type === "success") {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === "warning") {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (type === "error") {
        await Haptics.notification({ type: NotificationType.Error });
      }
    } else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const dur = type === "light" ? 15 : type === "medium" ? 30 : type === "heavy" ? 50 : 40;
      navigator.vibrate(dur);
    }
  } catch {
    // Graceful fallback if haptics hardware not permitted
  }
}

/**
 * Android Hardware Back Button listener.
 * Handler returns true if it handled the back press (e.g. closed a modal),
 * or false if default back behavior should occur.
 */
export function initHardwareBackButton(onBack: () => boolean): () => void {
  if (!isNative) return () => {};

  const handle = CapApp.addListener("backButton", () => {
    const handled = onBack();
    if (!handled) {
      // If at root and no modals, minimize app
      CapApp.minimizeApp();
    }
  });

  return () => {
    handle.then((h) => h.remove()).catch(() => {});
  };
}

/**
 * Initialize system bar insets and safe area measurements for Android.
 * Sets --status-bar-height on :root so content never collides with notches or system status bars.
 */
export async function initNativeSystemBars(): Promise<void> {
  if (!isNative) return;
  try {
    // Prevent webview from drawing behind the Android status bar
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Default safe status bar height on modern notch/punch-hole Android devices is 40-44px
    document.documentElement.style.setProperty("--status-bar-height", "44px");
  } catch {
    document.documentElement.style.setProperty("--status-bar-height", "44px");
  }
}

/**
 * Configure immersive status bar for Android.
 * Inverts status bar icons (light vs dark) based on active theme for perfect contrast
 * and applies matching background color.
 */
export async function configureStatusBar(isDark: boolean, bgColor?: string): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    const bg = bgColor || (isDark ? "#121816" : "#ffffff");
    await StatusBar.setBackgroundColor({ color: bg });
  } catch {
    // Graceful fallback
  }
}

/**
 * High-fidelity in-app synthesized bell chime using Web Audio API.
 * Plays a warm 3-tone harmonic chime (C5 → E5 → G5) without relying on external mp3 assets.
 */
export function playChimeSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const freqs = [528.0, 792.0, 1056.0]; // Meditative harmonic triad
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.48 / (idx + 1), now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 1.85);
    });
  } catch {
    // Graceful audio fallback
  }
}

/**
 * Deterministically hash any string ID to a 32-bit positive integer
 * required by Capacitor LocalNotifications.
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Initialize Android notification channels with sound and vibration enabled.
 */
export async function initNotificationChannels(): Promise<void> {
  if (!isNative) return;
  try {
    // Delete custom sound channels so Android applies native OS default notification sound
    try {
      await LocalNotifications.deleteChannel({ id: "focus-timer" });
      await LocalNotifications.deleteChannel({ id: "task-reminders" });
      await LocalNotifications.deleteChannel({ id: "focus-timer-v2" });
      await LocalNotifications.deleteChannel({ id: "task-reminders-v2" });
    } catch {}

    // Android Notification Channels without custom sound play the system OS notification sound
    await LocalNotifications.createChannel({
      id: "focus-channel-os",
      name: "Focus & Pomodoro Timer",
      description: "Alerts when Pomodoro, Countdown, or Break sessions finish",
      importance: 5, // High priority / Heads-up
      visibility: 1,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: "task-channel-os",
      name: "Task Due Alarms",
      description: "Alerts for upcoming and scheduled tasks",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.warn("Could not register notification channels:", err);
  }
}

/**
 * Request system notification permissions on Android (POST_NOTIFICATIONS).
 */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!isNative) {
    if ("Notification" in window) {
      const p = await Notification.requestPermission();
      return p === "granted";
    }
    return false;
  }
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Check current notification permission status.
 */
export async function checkNativeNotificationPermission(): Promise<boolean> {
  if (!isNative) {
    return "Notification" in window && Notification.permission === "granted";
  }
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a native reminder for a task using Android AlarmManager.
 * Runs even if the app is completely closed or device rebooted.
 */
export async function scheduleTaskDueNotification(
  task: { id: string; title: string; due?: string | null; dueTime?: string | null },
  leadMinutes = 0
): Promise<void> {
  if (!task.due || !task.dueTime) return;
  try {
    const [h, m] = task.dueTime.split(":").map(Number);
    const [year, month, day] = task.due.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day, h, m, 0);
    const targetTime = dueDate.getTime() - leadMinutes * 60 * 1000;

    // Only schedule future reminders
    if (targetTime <= Date.now()) return;

    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashStringToInt(`task-${task.id}`),
            title: leadMinutes > 0 ? `Task Due in ${leadMinutes}m ⏱️` : "Task Due Now ⏱️",
            body: task.title,
            schedule: { at: new Date(targetTime), allowWhileIdle: true },
            channelId: "task-channel-os",
          },
        ],
      });
    }
  } catch (err) {
    console.warn("Could not schedule task notification:", err);
  }
}

/**
 * Cancel a scheduled task reminder.
 */
export async function cancelTaskDueNotification(taskId: string): Promise<void> {
  try {
    if (isNative) {
      await LocalNotifications.cancel({
        notifications: [{ id: hashStringToInt(`task-${taskId}`) }],
      });
    }
  } catch {
    // Ignore if not scheduled
  }
}

const TIMER_NOTIFICATION_ID = 99999;

/**
 * Schedule an exact timer completion notification when a Pomodoro / Countdown begins.
 * Fires even if phone screen is locked or app is killed.
 */
export async function scheduleTimerEndNotification(
  durationMs: number,
  title: string,
  mode: string
): Promise<void> {
  if (!isNative || durationMs <= 0) return;
  try {
    const targetDate = new Date(Date.now() + durationMs);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TIMER_NOTIFICATION_ID,
          title: mode === "break" ? "Break Finished! ☕" : "Focus Session Complete! 🎯",
          body: title
            ? `Completed: "${title}". Great job! Tap to review.`
            : "Session ended. Time to stretch or start your next block.",
          schedule: { at: targetDate, allowWhileIdle: true },
          channelId: "focus-channel-os",
        },
      ],
    });
  } catch (err) {
    console.warn("Could not schedule timer end notification:", err);
  }
}

/**
 * Cancel any pending timer completion notification.
 */
export async function cancelTimerEndNotification(): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: TIMER_NOTIFICATION_ID }],
    });
  } catch {
    // Ignore
  }
}

/**
 * Send an immediate test notification with sound, haptics, and notification shade display.
 */
export async function sendNativeTestNotification(): Promise<void> {
  await triggerHaptic("success");

  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 10001,
          title: "LifeLog Notification 🚀",
          body: "Native Android notifications are active! Alarms will fire even when the app is closed.",
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          channelId: "task-channel-os",
        },
      ],
    });
  }
}
