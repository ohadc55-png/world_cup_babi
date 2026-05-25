// hook למצב התקנת PWA.
//
// 3 פלטפורמות, 3 התנהגויות:
//   - Chrome/Edge/Android: יורה event "beforeinstallprompt" → מתופס ב-deferred
//     → לחיצה על "התקן" קוראת ל-prompt() ומקבלת בחירת המשתמש.
//   - iOS Safari: לא יורה את האירוע. צריך להציג הוראות ידניות
//     (Share → Add to Home Screen).
//   - כבר מותקן (display-mode: standalone או navigator.standalone): לא מציג כלום.

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type PWAInstallState = {
  /** המשתמש כבר התקין (display-mode standalone או iOS standalone). */
  isInstalled: boolean;
  /** Chrome/Edge/Android חשפו prompt — אפשר לקרוא ל-install(). */
  canInstallNow: boolean;
  /** iOS Safari — אין prompt, צריך להציג הוראות ידניות. */
  needsIOSGuide: boolean;
  /** קורא ל-deferred prompt (רק כאשר canInstallNow=true). מחזיר 'accepted' / 'dismissed' / null. */
  install: () => Promise<"accepted" | "dismissed" | null>;
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari חשף את זה ב-navigator עוד לפני שהגיע ל-matchMedia
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true;
  return false;
}

export function usePWAInstall(): PWAInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS] = useState<boolean>(() => detectIOS());

  useEffect(() => {
    const onBefore = (e: Event) => {
      // Chrome עוצר את ה-banner האוטומטי; אנחנו שולטים מתי להציג
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(): Promise<"accepted" | "dismissed" | null> {
    if (!deferred) return null;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null); // אי-אפשר לקרוא ל-prompt פעמיים
      return choice.outcome;
    } catch {
      return null;
    }
  }

  return {
    isInstalled,
    canInstallNow: !!deferred && !isInstalled,
    needsIOSGuide: isIOS && !isInstalled,
    install,
  };
}
