// גרסה קומפקטית של InstallAppCard — שורה אחת, לעמודים שבהם המרחב מצומצם
// כמו Login/Onboarding. משתמש באותו hook ובאותו iOS modal.

import { useState } from "react";
import { Download, Smartphone, Check } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { IOSInstallModal } from "./IOSInstallModal";

export function InstallAppPill() {
  const { isInstalled, canInstallNow, needsIOSGuide, install } = usePWAInstall();
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // מותקן או הותקן זה עתה → mini-confirmation
  if (isInstalled || justInstalled) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-full px-4 py-2"
        style={{
          background: "rgba(6,167,125,0.10)",
          border: "1px solid rgba(6,167,125,0.32)",
        }}
      >
        <Check size={13} color="#06A77D" />
        <span className="text-[11.5px] font-bold text-white">האפליקציה מותקנת בטלפון</span>
      </div>
    );
  }

  // אין דרך להתקין → לא מציגים
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
    if (outcome === "accepted") setJustInstalled(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-end transition-all hover:scale-[1.01] disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, rgba(230,57,70,0.14), rgba(29,53,87,0.08))",
          border: "1.5px solid rgba(230,57,70,0.45)",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
        }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, #E63946, #1D3557)",
            boxShadow: "0 4px 12px -3px rgba(230,57,70,0.45)",
          }}
        >
          <Smartphone size={16} color="white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold text-white">התקן את האפליקציה לטלפון</p>
          <p className="mt-0.5 text-[10px] text-[color:var(--color-muted)]">
            {needsIOSGuide ? "הוראות התקנה ב-iPhone" : "אייקון במסך הבית, חוויה מלאה"}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg, #E63946, #C82A37)",
            boxShadow: "0 4px 10px -3px rgba(230,57,70,0.50)",
          }}
        >
          <Download size={11} />
          <span>{installing ? "מתקין..." : needsIOSGuide ? "מדריך" : "התקן"}</span>
        </div>
      </button>

      <IOSInstallModal open={showIOS} onClose={() => setShowIOS(false)} />
    </>
  );
}
