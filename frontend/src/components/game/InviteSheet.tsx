// InviteSheet — bottom sheet שמציג את הקוד של המשחק + אפשרויות שיתוף.
//
// נפתח מכפתור ה-"+חברים" בכותרת. תמיד נגיש (לא רק פעם אחת אחרי יצירת המשחק).
//
// פיצ'רים:
// - העתקה ל-clipboard
// - שיתוף נטיבי (Web Share API) — עובד ב-iOS Safari + Android Chrome
// - הצגת שם המשחק + מס' משתתפים נוכחי

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Share2, Users, KeyRound } from "lucide-react";
import type { Game } from "@/types";

type Props = {
  game: Game | null;
  onClose: () => void;
};

export function InviteSheet({ game, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const isOpen = game !== null;

  // נעילת scroll של ה-body כשהsheet פתוח
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  function copyCode() {
    if (!game) return;
    navigator.clipboard.writeText(game.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    if (!game) return;
    const text = `הצטרף ל-${game.name} במונדיאל 2026 🏆\nקוד הזמנה: ${game.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: game.name, text });
      } catch {
        // המשתמש ביטל — לא צריך לעשות כלום
      }
    } else {
      // fallback: copy
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && game && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(10, 14, 26, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[101] flex flex-col"
            style={{
              background: "linear-gradient(180deg, #14182a 0%, #0a0e1a 100%)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
              paddingBottom: "max(20px, env(safe-area-inset-bottom))",
              maxHeight: "85vh",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="h-1 w-10 rounded-full"
                style={{ background: "rgba(255,255,255,0.20)" }}
              />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
              aria-label="סגור"
            >
              <X size={18} color="#C8D0DD" />
            </button>

            {/* Content */}
            <div className="flex flex-col px-6 pt-2 pb-4">
              {/* Header */}
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-full"
                    style={{
                      background: "rgba(255,217,61,0.12)",
                      border: "1px solid rgba(255,217,61,0.35)",
                    }}
                  >
                    <KeyRound size={20} color="#FFD93D" />
                  </div>
                </div>
                <h2 className="text-[18px] font-extrabold text-white">הזמן חברים</h2>
                <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                  שלח את הקוד הבא לכל מי שרוצה להצטרף
                </p>
              </div>

              {/* Game name */}
              <div className="mt-5 text-center">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
                  המשחק
                </p>
                <p className="mt-1 text-[16px] font-bold text-white">{game.name}</p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10.5px] text-[color:var(--color-muted)]">
                  <Users size={11} />
                  <span>
                    <span className="num font-bold text-white">{game.member_count}</span>{" "}
                    {game.member_count === 1 ? "משתתף" : "משתתפים"}
                  </span>
                </div>
              </div>

              {/* Big invite code box */}
              <button
                onClick={copyCode}
                className="group relative mt-5 flex flex-col items-center gap-2 rounded-2xl py-6 transition-all hover:scale-[1.01]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,217,61,0.10) 0%, rgba(255,170,0,0.05) 100%)",
                  border: "1.5px solid rgba(255,217,61,0.36)",
                  boxShadow: "0 8px 28px -8px rgba(255,170,0,0.20)",
                }}
              >
                <span
                  className="num text-[30px] font-black tracking-[0.30em]"
                  style={{
                    color: "#FFD93D",
                    textShadow: "0 0 24px rgba(255,217,61,0.35)",
                  }}
                >
                  {game.invite_code}
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[color:var(--color-muted)]">
                  {copied ? (
                    <>
                      <Check size={13} color="#06A77D" />
                      <span style={{ color: "#06A77D" }}>הועתק!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>לחץ להעתקה</span>
                    </>
                  )}
                </span>
              </button>

              {/* Share button (native) */}
              <button
                onClick={shareNative}
                className="mt-3 flex h-13 items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #06A77D, #048662)",
                  boxShadow: "0 8px 24px -8px rgba(6,167,125,0.50)",
                }}
              >
                <Share2 size={17} />
                <span>שתף בכל אפליקציה</span>
              </button>

              {/* Hint */}
              <p className="mt-4 text-center text-[10.5px] leading-relaxed text-[color:var(--color-muted)]">
                החברים יכולים להירשם דרך המסך הראשי וללחוץ "הצטרף למשחק קיים" — שם יזינו את הקוד הזה.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
