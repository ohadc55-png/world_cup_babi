// hook לניהול state של push subscriptions.
//
// React + Push notifications:
// - הדפדפן הוא ה-source of truth (PushManager.getSubscription)
// - אנחנו רק עוזרים לתאר את המצב ולפעולה לפי דרישת המשתמש
// - אסור להשתמש subscribe() אוטומטית; חייב להיות action ביוזמת המשתמש

import { useEffect, useState } from "react";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

export type PushState =
  | "loading"           // עדיין בודקים מצב התחלתי
  | "unsupported"       // הדפדפן לא תומך
  | "denied"            // המשתמש סירב — אין דרך לחזור בלי הגדרות הדפדפן
  | "default"           // עוד לא נשאל
  | "subscribed"        // רשום ופעיל
  | "needs-resubscribe"; // יש אישור אבל אין subscription (אולי נמחק)

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    const perm = getNotificationPermission();
    if (perm === "denied") {
      setState("denied");
      return;
    }
    if (perm === "default") {
      setState("default");
      return;
    }
    // perm === "granted"
    const sub = await getExistingSubscription();
    setState(sub ? "subscribed" : "needs-resubscribe");
  }

  useEffect(() => {
    check();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush();
      setState("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
      await check();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      await check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בביטול");
    } finally {
      setBusy(false);
    }
  }

  return { state, error, busy, enable, disable, refresh: check };
}
