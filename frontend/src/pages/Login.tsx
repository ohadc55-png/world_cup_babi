// מסך כניסה ראשי — username + PIN למשתמש קיים, וקישור להרשמה.
//
// במודל הרב-משחקים (2026-05-23) זה ה-entry point: אין יותר "קוד הזמנה" ברמת
// החשבון. קוד ההזמנה הוא פר-משחק ומוזן ב-/game-select אחרי ההרשמה.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, ApiException } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { AuthSuccessResponse } from "@/types";
import { Logo } from "@/components/layout/Logo";
import { EntryBackground } from "@/components/layout/EntryBackground";
import { InstallAppPill } from "@/components/install/InstallAppPill";

export function Login() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuth();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("חובה להכניס שם משתמש");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN חייב להיות 4 ספרות");
      return;
    }

    setLoading(true);
    try {
      const res = await api<AuthSuccessResponse>("/api/auth/login", {
        method: "POST",
        body: { username: trimmedUsername, pin },
        auth: "none",
      });
      setSession(res);
      // ניווט: יש משחק → /home; אין משחק עדיין → /game-select
      navigate(res.game_id ? "/home" : "/game-select", { replace: true });
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.status === 401) setError("שם משתמש או PIN שגויים");
        else setError("שגיאה לא צפויה — נסה שוב");
      } else {
        setError("שגיאת רשת — בדוק שה-backend רץ");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="phone-shell relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-8">
      <EntryBackground />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <Logo size={72} />

        <h1 className="hbrw-display mt-6 text-center text-3xl text-white">
          ברוכים הבאים
        </h1>
        <p className="mt-2 text-center text-sm text-[color:var(--color-muted)]">
          הניחושים של החבר'ה למונדיאל <span className="num">2026</span>
        </p>
        <div
          className="num mt-1 text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.30em", color: "rgba(255, 217, 61, 0.8)" }}
        >
          Babi Group
        </div>

        <div className="mt-6 w-full">
          <InstallAppPill />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="eyebrow">שם משתמש</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="השם שלך"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg font-bold text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60 focus:bg-white/8"
              disabled={loading}
              maxLength={32}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="eyebrow">PIN</span>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{4}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              maxLength={4}
              className="num h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-2xl font-extrabold tracking-[0.4em] text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60 focus:bg-white/8"
              disabled={loading}
            />
          </label>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-medium text-[color:var(--color-error)]"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length !== 4}
            className="mt-3 h-14 rounded-2xl font-extrabold text-[15px] text-white transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #E63946, #B12E3D)",
              boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
            }}
          >
            {loading ? "בודק..." : "כניסה"}
          </button>
        </form>

        {/* קישור להרשמה */}
        <div className="mt-8 flex flex-col items-center gap-1">
          <p className="text-[11px] text-[color:var(--color-muted)]">אין לך חשבון עדיין?</p>
          <button
            onClick={() => navigate("/onboarding")}
            className="text-[13px] font-bold text-white underline decoration-[color:var(--color-brand-red)]/60 decoration-2 underline-offset-4 hover:decoration-[color:var(--color-brand-red)]"
          >
            הירשם עכשיו
          </button>
        </div>
      </motion.div>
    </div>
  );
}
