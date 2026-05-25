// Onboarding (= Sign Up) — 3 שלבים: שם משתמש, PIN, אישור
//
// במודל הרב-משחקים אין יותר צורך ב-invite code לרישום (כל אחד יכול להירשם).
// אחרי הרשמה מוצלחת המשתמש מנותב ל-/game-select לבחור משחק.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, ApiException } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { AuthSuccessResponse } from "@/types";
import { Logo } from "@/components/layout/Logo";
import { EntryBackground } from "@/components/layout/EntryBackground";

type Step = "username" | "pin" | "confirm";

export function Onboarding() {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuth();

  function nextFromUsername(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError("שם משתמש חייב להכיל לפחות 2 תווים");
      return;
    }
    if (trimmed.length > 32) {
      setError("שם משתמש עד 32 תווים");
      return;
    }
    setError(null);
    setUsername(trimmed);
    setStep("pin");
  }

  function nextFromPin(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("ה-PIN חייב להיות 4 ספרות");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    if (pin !== pinConfirm) {
      setError("ה-PIN לא תואם");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api<AuthSuccessResponse>("/api/auth/register", {
        method: "POST",
        body: { username, pin },
        auth: "none",
      });
      setSession(res);
      // משתמש חדש = אין לו עדיין משחק → /game-select
      navigate("/game-select", { replace: true });
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.status === 409) setError("שם המשתמש כבר תפוס");
        else setError("שגיאה ביצירת חשבון");
      } else {
        setError("שגיאת רשת");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="phone-shell relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-8">
      <EntryBackground />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Logo size={40} />

        {/* progress indicator — 3 נקודות */}
        <div className="mt-6 flex items-center gap-2">
          {(["username", "pin", "confirm"] as Step[]).map((s, idx) => {
            const stepIdx = (["username", "pin", "confirm"] as Step[]).indexOf(step);
            const done = idx <= stepIdx;
            return (
              <div
                key={s}
                className="h-1 rounded-full transition-all"
                style={{
                  width: idx === stepIdx ? 28 : 12,
                  background: done ? "#E63946" : "rgba(255,255,255,0.15)",
                }}
              />
            );
          })}
        </div>

        {/* AnimatePresence + motion = החלפה מונפשת בין שלבים */}
        <AnimatePresence mode="wait">
          {step === "username" && (
            <motion.form
              key="username"
              onSubmit={nextFromUsername}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="mt-8 flex w-full flex-col gap-4"
            >
              <h1 className="hbrw-display text-center text-2xl text-white">
                איך נקרא לך?
              </h1>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="השם שלך"
                autoFocus
                className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg font-bold text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60"
                maxLength={32}
              />
              {error && (
                <p className="text-center text-sm font-medium text-[color:var(--color-error)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!username.trim()}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #E63946, #B12E3D)",
                  boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
                }}
              >
                המשך
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-[12px] font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                כבר רשום? כניסה
              </button>
            </motion.form>
          )}

          {step === "pin" && (
            <motion.form
              key="pin"
              onSubmit={nextFromPin}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="mt-8 flex w-full flex-col gap-4"
            >
              <h1 className="hbrw-display text-center text-2xl text-white">
                בחר קוד PIN
              </h1>
              <p className="text-center text-sm text-[color:var(--color-muted)]">
                4 ספרות, ישמשו אותך לכניסות הבאות
              </p>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{4}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                autoFocus
                maxLength={4}
                className="num h-16 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-3xl font-extrabold tracking-[0.5em] text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60"
              />
              {error && (
                <p className="text-center text-sm font-medium text-[color:var(--color-error)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pin.length !== 4}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #E63946, #B12E3D)",
                  boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
                }}
              >
                המשך
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("username");
                }}
                className="text-sm font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                חזרה
              </button>
            </motion.form>
          )}

          {step === "confirm" && (
            <motion.form
              key="confirm"
              onSubmit={submitRegister}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="mt-8 flex w-full flex-col gap-4"
            >
              <h1 className="hbrw-display text-center text-2xl text-white">
                אישור PIN
              </h1>
              <p className="text-center text-sm text-[color:var(--color-muted)]">
                הקלד את ה-PIN שוב
              </p>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{4}"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                autoFocus
                maxLength={4}
                className="num h-16 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-3xl font-extrabold tracking-[0.5em] text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60"
              />
              {error && (
                <p className="text-center text-sm font-medium text-[color:var(--color-error)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || pinConfirm.length !== 4}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #E63946, #B12E3D)",
                  boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
                }}
              >
                {loading ? "יוצר חשבון..." : "סיום הרשמה"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPinConfirm("");
                  setStep("pin");
                }}
                className="text-sm font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                חזרה
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
