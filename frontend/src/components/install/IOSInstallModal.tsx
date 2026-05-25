// מודל הוראות התקנה ל-iOS Safari (אין beforeinstallprompt).
// פותחים אותו רק אם needsIOSGuide=true.

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function IOSInstallModal({ open, onClose }: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(10,14,26,0.72)", backdropFilter: "blur(8px)" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-[101] mx-auto max-w-md p-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            <div
              className="rounded-3xl p-6"
              style={{
                background: "linear-gradient(180deg, rgba(20,27,45,0.95), rgba(15,20,38,0.95))",
                backdropFilter: "blur(20px) saturate(160%)",
                WebkitBackdropFilter: "blur(20px) saturate(160%)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold text-white">התקנה ב-iPhone</h3>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/10"
                  aria-label="סגור"
                >
                  <X size={16} color="#C8D0DD" />
                </button>
              </div>

              <p className="mb-5 text-[12.5px] text-[color:var(--color-muted)]">
                ב-Safari צריך להוסיף ידנית למסך הבית:
              </p>

              <ol className="flex flex-col gap-3">
                <Step
                  num={1}
                  text="לחץ על כפתור השיתוף בתחתית המסך"
                  icon={<Share size={18} color="#7BB3F2" />}
                />
                <Step
                  num={2}
                  text='גלול ובחר "הוסף למסך הבית"'
                  icon={<Plus size={18} color="#FFD93D" />}
                />
                <Step num={3} text='לחץ "הוסף" בפינה הימנית-עליונה' icon={null} />
              </ol>

              <div
                className="mt-5 rounded-2xl p-3 text-center text-[11px] text-[color:var(--color-muted)]"
                style={{
                  background: "rgba(255,217,61,0.06)",
                  border: "1px solid rgba(255,217,61,0.20)",
                }}
              >
                האייקון של המונדיאל יופיע במסך הבית כמו אפליקציה רגילה
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Step({ num, text, icon }: { num: number; text: string; icon: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
        style={{
          background: "linear-gradient(135deg, #E63946, #1D3557)",
          color: "white",
        }}
      >
        {num}
      </div>
      <span className="flex-1 text-[12.5px] font-bold text-white">{text}</span>
      {icon && <div className="shrink-0">{icon}</div>}
    </li>
  );
}
