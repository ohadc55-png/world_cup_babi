// Service Worker למונדיאל 2026
//
// תפקידים:
//   1. push event listener — מציג notification כשמגיע push מהשרת
//   2. notificationclick — פותח את האפליקציה במסך הרלוונטי
//   3. caching מינימלי (workbox manifest מוזרק אוטומטית ע"י vite-plugin-pwa)
//
// strategies: injectManifest — הקובץ הזה נטען כפי שהוא + vite מזריק את
// self.__WB_MANIFEST שמכיל רשימת assets ל-precache.

// eslint-disable-next-line no-restricted-globals
const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

import { precacheAndRoute } from "workbox-precaching";

// ===== Precache =====
// מזרק נתונים סטטיים שיהיו זמינים offline
precacheAndRoute(self.__WB_MANIFEST || []);

// ===== Push listener =====
sw.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("[SW] push received without data");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // fallback אם השרת שלח טקסט פשוט (לא JSON)
    payload = {
      title: "מונדיאל 2026",
      body: event.data.text(),
    };
  }

  const {
    title = "מונדיאל 2026",
    body = "",
    icon = "/icon-192.png",
    badge = "/icon-192.png",
    tag,
    url,
    data = {},
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,                      // אותו tag = ה-notification מחליפה את הקודמת (anti-spam)
    dir: "rtl",
    lang: "he",
    requireInteraction: false,
    data: { url, ...data },   // מועבר ל-notificationclick
  };

  event.waitUntil(sw.registration.showNotification(title, options));
});

// ===== Notification click =====
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // ה-URL להעביר אליו (אם השרת ציין)
  const targetUrl = event.notification.data?.url || "/home";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // אם האפליקציה כבר פתוחה — מעבירים אותה לרקע
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if (client.url !== targetUrl && "navigate" in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // אם לא פתוחה — פותחים window חדש
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
    }),
  );
});

// ===== Skip waiting on install =====
// אחרי deploy חדש — ה-SW החדש משתלט מיד (לא צריך לסגור את הטאב)
sw.addEventListener("install", () => {
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});
