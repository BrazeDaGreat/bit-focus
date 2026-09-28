/**
 * System Notifications
 *
 * Thin wrapper over the browser Notification API for timer phase changes.
 * Every call is a no-op where the API is missing or permission was not
 * granted, so callers never have to check first.
 *
 * @fileoverview Browser notification helpers
 * @author BIT Focus Development Team
 * @since v0.23.0-beta
 */

/** True when this browser can show system notifications at all. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Ask for notification permission.
 *
 * @returns The resulting permission, or "denied" where unsupported.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Show a system notification if permission is granted.
 *
 * @param title - Notification heading.
 * @param body - Supporting line.
 */
export function showSystemNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/bit_focus.png",
      tag: "bitfocus-timer",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some mobile browsers expose the constructor but only allow notifications
    // through a service worker registration.
    navigator.serviceWorker?.ready
      .then((reg) =>
        reg.showNotification(title, { body, icon: "/bit_focus.png", tag: "bitfocus-timer" })
      )
      .catch(() => {});
  }
}
