// באנר ידידותי שמוצג רק ל-iOS Safari (לא standalone, לא נדחה ב-7 ימים אחרונים).
// מסביר איך להוסיף את האפליקציה למסך הבית כדי לקבל push notifications.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus } from "lucide-react";
import { isIOS, isStandalone, isIOSBannerDismissed, dismissIOSBanner } from "@/lib/pwa";

export function IOSInstallBanner() {
  // קובעים פעם אחת בהתחלה האם להציג. לא משתמשים ב-useEffect כי הערך לא משתנה.
  const [visible, setVisible] = useState(() => {
    if (!isIOS()) return false;
    if (isStandalone()) return false;
    if (isIOSBannerDismissed()) return false;
    return true;
  });

  function handleDismiss() {
    dismissIOSBanner();
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 260 }}
          className="fixed bottom-0 inset-x-0 z-[90] mx-3 mb-3"
          style={{
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="relative overflow-hidden rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #14182a 0%, #1d2541 100%)",
              border: "1px solid rgba(255,217,61,0.32)",
              boxShadow: "0 16px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,217,61,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
              aria-label="סגור"
            >
              <X size={14} color="#C8D0DD" />
            </button>

            {/* Content */}
            <div className="flex flex-col gap-2.5 pe-6">
              <p className="text-[13.5px] font-extrabold text-white">
                התקן את האפליקציה למסך הבית
              </p>
              <p className="text-[11.5px] leading-relaxed text-[color:var(--color-muted)]">
                כדי לקבל התראות על משחקים, תוצאות ועדכוני דירוג.
              </p>

              {/* Steps */}
              <div className="mt-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(255,217,61,0.18)", color: "#FFD93D" }}
                  >
                    1
                  </span>
                  <div className="flex items-center gap-1.5 text-[12px] text-white">
                    <span>לחץ על</span>
                    <Share size={14} color="#FFD93D" />
                    <span className="text-[color:var(--color-muted)]">בתחתית הדפדפן</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(255,217,61,0.18)", color: "#FFD93D" }}
                  >
                    2
                  </span>
                  <div className="flex items-center gap-1.5 text-[12px] text-white">
                    <span>בחר</span>
                    <span className="flex items-center gap-0.5">
                      <Plus size={12} color="#FFD93D" />
                      <span style={{ color: "#FFD93D" }}>הוסף למסך הבית</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
