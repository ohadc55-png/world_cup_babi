// פונקציות עזר ל-PWA install detection
//
// iOS Safari לא תומך ב-beforeinstallprompt event (כמו Chrome/Android).
// לכן צריך לזהות ידנית: אם זה iOS + Safari + לא standalone, מציגים הוראות
// "הוסף למסך הבית" ידנית.

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** האם המשתמש פתח את האפליקציה במצב standalone (= הותקנה במסך הבית). */
export function isStandalone(): boolean {
  // iOS standalone API
  if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) {
    return true;
  }
  // PWA standalone (Chrome / Edge / Firefox)
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Push notifications לא זמינות ב-iOS בלי PWA install. */
export function pushRequiresInstall(): boolean {
  return isIOS() && !isStandalone();
}

const DISMISSED_KEY = "mundial2026_ios_install_dismissed";
const DISMISS_DAYS = 7;

export function isIOSBannerDismissed(): boolean {
  const ts = localStorage.getItem(DISMISSED_KEY);
  if (!ts) return false;
  const dismissedAt = parseInt(ts, 10);
  if (isNaN(dismissedAt)) return false;
  const daysAgo = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysAgo < DISMISS_DAYS;
}

export function dismissIOSBanner(): void {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}
