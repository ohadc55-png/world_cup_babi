// Helpers ל-Push Subscription דרך browser PushManager.
//
// זרימה:
// 1. אם הדפדפן תומך + אישור הופעל ביוזמת המשתמש (לא ב-autoload!)
// 2. בודקים אם כבר יש subscription פעיל
// 3. אם לא — יוצרים חדש עם applicationServerKey (VAPID public key)
// 4. שולחים את ה-endpoint+keys ל-backend /api/push/subscribe

import { api } from "@/lib/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** ממיר base64url ל-Uint8Array (פורמט שדורש PushManager.subscribe). */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const padded = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** מחזיר את ה-subscription הקיים, או null אם לא רשום. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}

/**
 * זרימת רישום מלאה:
 * 1. בקשת אישור התראות מהמשתמש
 * 2. יצירת subscription דרך PushManager
 * 3. שליחה ל-backend
 *
 * זורק שגיאה אם משהו נכשל. הקורא אחראי לתפיסת השגיאה ולעדכון UI.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("הדפדפן לא תומך ב-Push Notifications");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VAPID_PUBLIC_KEY חסר ב-frontend .env");
  }

  // 1. אישור התראות
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("המשתמש לא אישר התראות");
  }

  // 2. יצירת subscription
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 3. שליחה ל-backend
  const subJson = sub.toJSON();
  await api("/api/push/subscribe", {
    method: "POST",
    body: {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      user_agent: navigator.userAgent,
    },
  });

  return sub;
}

/** ביטול subscription. */
export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;

  await api("/api/push/unsubscribe", {
    method: "POST",
    body: { endpoint: sub.endpoint },
  });
  await sub.unsubscribe();
}

/** שליחת push test ל-עצמי — לבדיקות. */
export async function sendTestPush(): Promise<{ sent: number; failed: number }> {
  return await api("/api/push/test", { method: "POST" });
}
