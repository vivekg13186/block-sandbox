// Desktop notifications via the Tauri notification plugin, with a browser
// Notification fallback.

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (inTauri()) {
      const n = await import("@tauri-apps/plugin-notification");
      let granted = await n.isPermissionGranted();
      if (!granted) granted = (await n.requestPermission()) === "granted";
      if (granted) n.sendNotification({ title, body });
      return;
    }
    if (typeof Notification !== "undefined") {
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm === "granted") new Notification(title, { body });
    }
  } catch {
    /* notifications are best-effort */
  }
}
