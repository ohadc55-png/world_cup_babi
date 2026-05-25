// GameSelect — אחרי הרשמה (או login עם game_id=null), המשתמש חייב לבחור:
//   1. ליצור משחק חדש (יקבל invite_code לשתף עם חברים)
//   2. להצטרף למשחק קיים בעזרת invite_code
//
// אחרי בחירה — מנותב ל-/home.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, KeyRound, Trophy, Users, Copy, Check } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";
import { EntryBackground } from "@/components/layout/EntryBackground";
import type { Game } from "@/types";

type Mode = "choose" | "create" | "join" | "created";

export function GameSelect() {
  const [mode, setMode] = useState<Mode>("choose");
  const [gameName, setGameName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdGame, setCreatedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { user, setGameId, logout } = useAuth();

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (gameName.trim().length < 2) {
      setError("שם המשחק חייב לפחות 2 תווים");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const game = await api<Game>("/api/games/create", {
        method: "POST",
        body: { name: gameName.trim() },
      });
      setCreatedGame(game);
      setGameId(game.id);
      setMode("created");
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.status === 409) setError("כבר אתה במשחק");
        else if (err.status === 410) setError("הטורניר כבר התחיל - לא ניתן ליצור משחק חדש");
        else setError("שגיאה ביצירת המשחק");
      } else {
        setError("שגיאת רשת");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("קוד הזמנה לא תקין");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const game = await api<Game>("/api/games/join", {
        method: "POST",
        body: { invite_code: code },
      });
      setGameId(game.id);
      navigate("/home", { replace: true });
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.status === 404) setError("קוד הזמנה לא קיים");
        else if (err.status === 409) setError("כבר אתה במשחק");
        else if (err.status === 410) setError("הטורניר כבר התחיל - לא ניתן להצטרף יותר");
        else setError("שגיאה בהצטרפות");
      } else {
        setError("שגיאת רשת");
      }
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!createdGame) return;
    navigator.clipboard.writeText(createdGame.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="phone-shell relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-8">
      <EntryBackground />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <Logo size={56} />

        <h1 className="hbrw-display mt-5 text-center text-2xl text-white">
          {mode === "choose" && `שלום, ${user?.username ?? ""}`}
          {mode === "create" && "צור משחק חדש"}
          {mode === "join" && "הצטרף למשחק"}
          {mode === "created" && "המשחק נוצר!"}
        </h1>
        {mode === "choose" && (
          <p className="mt-2 text-center text-sm text-[color:var(--color-muted)]">
            בחר איך להתחיל
          </p>
        )}

        <AnimatePresence mode="wait">
          {/* ===== CHOOSE ===== */}
          {mode === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-8 flex w-full flex-col gap-3"
            >
              <ChoiceCard
                icon={<Plus size={22} color="#fff" />}
                title="צור משחק חדש"
                subtitle="אתה תהיה ה-owner ותקבל קוד לשתף עם חברים"
                onClick={() => {
                  setError(null);
                  setMode("create");
                }}
                accent="red"
              />
              <ChoiceCard
                icon={<KeyRound size={22} color="#fff" />}
                title="הצטרף למשחק קיים"
                subtitle="קיבלת קוד הזמנה? הזן אותו כאן"
                onClick={() => {
                  setError(null);
                  setMode("join");
                }}
                accent="green"
              />

              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="mt-4 text-[12px] font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                התנתק
              </button>
            </motion.div>
          )}

          {/* ===== CREATE ===== */}
          {mode === "create" && (
            <motion.form
              key="create"
              onSubmit={handleCreate}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="mt-8 flex w-full flex-col gap-3"
            >
              <label className="flex flex-col gap-2">
                <span className="eyebrow">שם המשחק</span>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="למשל: באבי מונדיאל 2026"
                  autoFocus
                  maxLength={60}
                  className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-[15px] font-bold text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60 focus:bg-white/8"
                />
              </label>

              {error && (
                <p className="text-center text-sm font-medium text-[color:var(--color-error)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || gameName.trim().length < 2}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #E63946, #B12E3D)",
                  boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
                }}
              >
                {loading ? "יוצר..." : "צור משחק"}
              </button>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-[12px] font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                חזרה
              </button>
            </motion.form>
          )}

          {/* ===== JOIN ===== */}
          {mode === "join" && (
            <motion.form
              key="join"
              onSubmit={handleJoin}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="mt-8 flex w-full flex-col gap-3"
            >
              <label className="flex flex-col gap-2">
                <span className="eyebrow">קוד הזמנה</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEFGH"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  maxLength={24}
                  className="num h-14 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-xl font-extrabold tracking-[0.25em] text-white placeholder:text-white/25 outline-none focus:border-[color:var(--color-brand-red)]/60 focus:bg-white/8"
                />
              </label>

              {error && (
                <p className="text-center text-sm font-medium text-[color:var(--color-error)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || inviteCode.trim().length < 4}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #06A77D, #048662)",
                  boxShadow: "0 12px 32px -10px rgba(6,167,125,0.6)",
                }}
              >
                {loading ? "מצטרף..." : "הצטרף"}
              </button>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-[12px] font-medium text-[color:var(--color-muted)] hover:text-white"
              >
                חזרה
              </button>
            </motion.form>
          )}

          {/* ===== CREATED ===== */}
          {mode === "created" && createdGame && (
            <motion.div
              key="created"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 flex w-full flex-col gap-5"
            >
              <div className="flex justify-center">
                <div
                  className="grid h-16 w-16 place-items-center rounded-full"
                  style={{
                    background: "rgba(6,167,125,0.18)",
                    border: "1px solid rgba(6,167,125,0.40)",
                  }}
                >
                  <Trophy size={28} color="#06A77D" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-[18px] font-extrabold text-white">{createdGame.name}</p>
                <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                  שתף את הקוד הבא עם החברים שלך:
                </p>
              </div>

              <button
                onClick={copyCode}
                className="group relative flex flex-col items-center gap-2 rounded-2xl py-5 transition-all hover:scale-[1.01]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,217,61,0.08) 0%, rgba(255,170,0,0.04) 100%)",
                  border: "1.5px solid rgba(255,217,61,0.32)",
                  boxShadow: "0 8px 24px -8px rgba(255,170,0,0.18)",
                }}
              >
                <span
                  className="num text-[28px] font-black tracking-[0.30em]"
                  style={{ color: "#FFD93D", textShadow: "0 0 20px rgba(255,217,61,0.30)" }}
                >
                  {createdGame.invite_code}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[color:var(--color-muted)]">
                  {copied ? (
                    <>
                      <Check size={12} color="#06A77D" />
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

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-muted)]">
                <Users size={12} />
                <span>
                  <span className="num font-bold text-white">{createdGame.member_count}</span>{" "}
                  משתתפים עד כה
                </span>
              </div>

              <button
                onClick={() => navigate("/home", { replace: true })}
                className="mt-2 h-14 rounded-2xl font-extrabold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #E63946, #B12E3D)",
                  boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
                }}
              >
                כניסה למשחק
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================
// ChoiceCard — כרטיס בחירה גדול
// ============================================================

function ChoiceCard({
  icon,
  title,
  subtitle,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent: "red" | "green";
}) {
  const accentColor = accent === "red" ? "#E63946" : "#06A77D";
  const accentBg = accent === "red" ? "rgba(230,57,70,0.10)" : "rgba(6,167,125,0.10)";

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl p-4 text-end transition-all hover:scale-[1.01]"
      style={{
        background: "rgba(20, 27, 45, 0.55)",
        border: `1.5px solid ${accentColor}40`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold text-white">{title}</p>
        <p className="mt-1 text-[11.5px] text-[color:var(--color-muted)]">{subtitle}</p>
      </div>
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-all group-hover:scale-110"
        style={{
          background: accentBg,
          border: `1px solid ${accentColor}60`,
        }}
      >
        {icon}
      </div>
    </button>
  );
}
