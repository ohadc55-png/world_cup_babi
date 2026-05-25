// כרטיס "הורד את האפליקציה" לפרופיל.
// מסתתר אם המשתמש כבר התקין; אחרת מציג כפתור התקנה (Chrome) או פותח מודל הוראות (iOS).

import { useState } from "react";
import { Download, Smartphone, Check } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { IOSInstallModal } from "./IOSInstallModal";

export function InstallAppCard() {
  const { isInstalled, canInstallNow, needsIOSGuide, install } = usePWAInstall();
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // מותקן → מציג רק badge קצר (מאשר למשתמש שהכל בסדר)
  if (isInstalled) {
    return (
      <section
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "rgba(6,167,125,0.08)",
          border: "1px solid rgba(6,167,125,0.32)",
        }}
      >
        <Check size={16} color="#06A77D" />
        <span className="text-[12.5px] font-bold text-white">האפליקציה מותקנת במכשיר</span>
      </section>
    );
  }

  // אין דרך להתקין (לא Chrome ולא iOS — לדוגמה Firefox Android) → לא מציגים
  if (!canInstallNow && !needsIOSGuide) {
    return null;
  }

  async function handleClick() {
    if (needsIOSGuide) {
      setShowIOS(true);
      return;
    }
    setInstalling(true);
    const outcome = await install();
    setInstalling(false);
    if (outcome === "accepted") {
      setJustInstalled(true);
    }
  }

  // מותקן עכשיו (תהליך appinstalled לוקח שנייה) → mini-success ביניים
  if (justInstalled) {
    return (
      <section
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "rgba(6,167,125,0.10)",
          border: "1px solid rgba(6,167,125,0.36)",
        }}
      >
        <Check size={16} color="#06A77D" />
        <span className="text-[12.5px] font-bold text-white">הותקן! בדוק את מסך הבית.</span>
      </section>
    );
  }

  return (
    <>
      <section
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(230,57,70,0.10), rgba(29,53,87,0.05))",
          border: "1px solid rgba(230,57,70,0.28)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #E63946, #1D3557)",
              boxShadow: "0 6px 16px -4px rgba(230,57,70,0.40)",
            }}
          >
            <Smartphone size={18} color="white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13.5px] font-extrabold text-white">הורד את האפליקציה</h3>
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
              {needsIOSGuide
                ? "התקן ב-iPhone כדי לקבל אייקון במסך הבית"
                : "התקן אותה לטלפון לחוויה כמו אפליקציה רגילה"}
            </p>
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={installing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-extrabold transition-all hover:scale-[1.01] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #E63946, #C82A37)",
            color: "white",
            boxShadow: "0 8px 20px -6px rgba(230,57,70,0.50)",
          }}
        >
          <Download size={14} />
          <span>{installing ? "מתקין..." : needsIOSGuide ? "איך להתקין" : "התקן עכשיו"}</span>
        </button>
      </section>

      <IOSInstallModal open={showIOS} onClose={() => setShowIOS(false)} />
    </>
  );
}
