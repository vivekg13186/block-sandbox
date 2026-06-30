// Desktop notifications via the browser Notification API (best-effort).

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (typeof Notification === "undefined") return;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") new Notification(title, { body });
  } catch {
    /* notifications are best-effort */
  }
}
