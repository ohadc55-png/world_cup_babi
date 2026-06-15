// עמוד פרופיל — מידע אישי, ניהול המשחק, הגדרות התראות, יציאה.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell, Users, KeyRound, LogOut, Shield, Copy, Check, Send,
  Trophy, Crown, Calendar, ChevronLeft, AlertTriangle, BookOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyGame } from "@/hooks/useGame";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { sendTestPush } from "@/lib/push";
import { api, ApiException } from "@/lib/api";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import { InstallAppCard } from "@/components/install/InstallAppCard";

export function Profile() {
  const { user, logout } = useAuth();
  const { data: game, refetch: refetchGame } = useMyGame();
  const { prefs, hasSubscription, saving, error: prefsError, updatePref } = useNotificationPrefs();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [leavingGame, setLeavingGame] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function handleSendTest() {
    setTestStatus("sending");
    try {
      const r = await sendTestPush();
      setTestStatus(r.sent > 0 ? "sent" : "error");
      setTimeout(() => setTestStatus("idle"), 3000);
    } catch {
      setTestStatus("error");
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  }

  function copyCode() {
    if (!game) return;
    navigator.clipboard.writeText(game.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLeave() {
    if (!leaveConfirm) {
      setLeaveConfirm(true);
      setTimeout(() => setLeaveConfirm(false), 5000);
      return;
    }
    setLeavingGame(true);
    try {
      await api("/api/games/leave", { method: "DELETE" });
      navigate("/game-select", { replace: true });
    } catch (e) {
      if (e instanceof ApiException) alert(`לא ניתן: ${e.detail}`);
      setLeavingGame(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc7.webp" intensity="balanced" />
      <div className="relative z-10">
      {/* === Header === */}
      <header
        className="sticky top-0 z-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.78), rgba(10,14,26,0.30) 70%, transparent)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          paddingTop: "max(14px, env(safe-area-inset-top))",
        }}
      >
        <div className="flex h-11 items-center justify-between px-5">
          <span className="eyebrow">פרופיל</span>
          <Logo size={24} showWordmark showTagline />
        </div>
      </header>

      <main className="px-5 pt-4 flex flex-col gap-5">
        {/* ============ HERO: avatar + שם ============ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center pt-4 pb-2"
        >
          <div
            className="grid h-20 w-20 place-items-center rounded-full text-[28px] font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #E63946, #1D3557)",
              boxShadow:
                "0 12px 32px -8px rgba(230,57,70,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.18)",
            }}
          >
            {initial}
          </div>
          <p className="mt-3 text-[18px] font-extrabold text-white">{user?.username}</p>
          {joinedDate && (
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[color:var(--color-muted)]">
              <Calendar size={10} />
              <span>חבר מ-{joinedDate}</span>
            </p>
          )}
          {user?.is_admin && (
            <div
              className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-bold uppercase"
              style={{
                background: "rgba(255,217,61,0.15)",
                color: "#FFD93D",
                border: "1px solid rgba(255,217,61,0.4)",
                letterSpacing: "0.12em",
              }}
            >
              <Shield size={9} />
              <span>Admin</span>
            </div>
          )}
        </motion.section>

        {/* ============ INSTALL APP ============ */}
        <InstallAppCard />

        {/* ============ GAME CARD ============ */}
        {game && (
          <Section title="המשחק שלי" icon={<Trophy size={16} color="#FFD93D" />}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-white">{game.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[color:var(--color-muted)]">
                    <Users size={11} />
                    <span>
                      <span className="num font-bold text-white">{game.member_count}</span>{" "}
                      {game.member_count === 1 ? "משתתף" : "משתתפים"}
                    </span>
                  </p>
                </div>
                {game.is_owner && (
                  <div
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold"
                    style={{
                      background: "rgba(255,217,61,0.15)",
                      color: "#FFD93D",
                      border: "1px solid rgba(255,217,61,0.40)",
                    }}
                  >
                    <Crown size={10} />
                    <span>Owner</span>
                  </div>
                )}
              </div>

              {/* קוד הזמנה - רק owner ולפני התחלת טורניר */}
              {game.is_owner && !game.tournament_has_started && (
                <button
                  onClick={copyCode}
                  className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:scale-[1.005]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,217,61,0.10) 0%, rgba(255,170,0,0.05) 100%)",
                    border: "1px solid rgba(255,217,61,0.32)",
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
                      קוד הזמנה
                    </span>
                    <span
                      className="num mt-0.5 text-[15px] font-extrabold tracking-[0.2em]"
                      style={{ color: "#FFD93D" }}
                    >
                      {game.invite_code}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10.5px] font-bold text-[color:var(--color-muted)]">
                    {copied ? (
                      <>
                        <Check size={11} color="#06A77D" />
                        <span style={{ color: "#06A77D" }}>הועתק</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>העתק</span>
                      </>
                    )}
                  </span>
                </button>
              )}

              {/* עזיבת משחק - לא לowner */}
              {!game.is_owner && (
                <button
                  onClick={handleLeave}
                  disabled={leavingGame}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-bold transition-all disabled:opacity-50"
                  style={{
                    background: leaveConfirm
                      ? "rgba(230,57,70,0.18)"
                      : "rgba(255,255,255,0.04)",
                    color: leaveConfirm ? "#FF7A85" : "#C8D0DD",
                    border: `1px solid ${leaveConfirm ? "rgba(230,57,70,0.45)" : "rgba(255,255,255,0.10)"}`,
                  }}
                >
                  {leaveConfirm ? (
                    <>
                      <AlertTriangle size={13} />
                      <span>לחץ שוב לאישור</span>
                    </>
                  ) : (
                    <span>עזוב משחק</span>
                  )}
                </button>
              )}
            </div>
          </Section>
        )}

        {/* ============ NOTIFICATIONS ============ */}
        <Section title="התראות" icon={<Bell size={16} color="#9BBAEA" />}>
          {!hasSubscription ? (
            <div className="rounded-xl p-3 text-[12px] text-[color:var(--color-muted)]" style={{ background: "rgba(255,255,255,0.03)" }}>
              ההתראות לא מופעלות במכשיר זה. חזור לעמוד הבית כדי להפעיל.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Toggle
                label="תזכורות לפני משחקים"
                description="שעה לפני kickoff, רק למה שלא ניחשת"
                value={prefs.reminder}
                onChange={(v) => updatePref("reminder", v)}
                disabled={saving}
              />
              <Toggle
                label="תוצאות משחקים"
                description="אחרי שמשחק נגמר וקיבלת ניקוד"
                value={prefs.result}
                onChange={(v) => updatePref("result", v)}
                disabled={saving}
              />
              <Toggle
                label="שינויי דירוג"
                description="כשעקפו אותך / כשעלית למקום"
                value={prefs.overtaken}
                onChange={(v) => updatePref("overtaken", v)}
                disabled={saving}
              />
              <Toggle
                label="התחלת משחק"
                description="כשמשחק עובר ל-live (יכול להיות רעשני)"
                value={prefs.kickoff}
                onChange={(v) => updatePref("kickoff", v)}
                disabled={saving}
              />
              <Toggle
                label="שלב פלייאוף חדש"
                description="כשנפתח R32, R16, וכו'"
                value={prefs.stage}
                onChange={(v) => updatePref("stage", v)}
                disabled={saving}
              />
              <Toggle
                label="סיכום שבועי"
                description="כל יום ראשון 19:00"
                value={prefs.weekly}
                onChange={(v) => updatePref("weekly", v)}
                disabled={saving}
              />
              {prefsError && (
                <p className="mt-2 text-center text-[11px]" style={{ color: "#FF7A85" }}>{prefsError}</p>
              )}
              {/* כפתור בדיקה */}
              <button
                onClick={handleSendTest}
                disabled={testStatus === "sending"}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold text-white transition-all disabled:opacity-50"
                style={{
                  background: testStatus === "sent"
                    ? "linear-gradient(135deg, #06A77D, #048662)"
                    : "linear-gradient(135deg, #1D3557, #14182a)",
                  border: "1px solid rgba(155,186,234,0.30)",
                }}
              >
                {testStatus === "sending" ? "שולח..." :
                  testStatus === "sent" ? (<><Check size={13} /><span>נשלח</span></>) :
                  testStatus === "error" ? "שגיאה - נסה שוב" :
                  (<><Send size={13} /><span>שלח התראת בדיקה</span></>)}
              </button>
            </div>
          )}
        </Section>

        {/* ============ HELP / RULES ============ */}
        <Section title="עזרה" icon={<BookOpen size={16} color="#9BBAEA" />}>
          <button
            onClick={() => navigate("/rules")}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-end transition-all hover:bg-white/5"
            style={{
              background: "rgba(155,186,234,0.06)",
              border: "1px solid rgba(155,186,234,0.20)",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">חוקים ושיטת ניקוד</p>
              <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
                כל הקטגוריות, Double Down, ומתי נעול
              </p>
            </div>
            <ChevronLeft size={15} color="#9BBAEA" />
          </button>
        </Section>

        {/* ============ ACCOUNT ============ */}
        <Section title="חשבון" icon={<KeyRound size={16} color="#C8D0DD" />}>
          <div className="flex flex-col gap-2">
            <DisabledAction label="החלפת PIN" subtitle="בקרוב" />
            <button
              onClick={handleLogout}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-[13px] font-bold transition-all hover:bg-white/5"
              style={{
                background: "rgba(230,57,70,0.08)",
                color: "#FF7A85",
                border: "1px solid rgba(230,57,70,0.25)",
              }}
            >
              <span>התנתק</span>
              <LogOut size={15} />
            </button>
          </div>
        </Section>

        {/* ============ ADMIN (only if admin) ============ */}
        {user?.is_admin && (
          <Section title="כלי אדמין" icon={<Shield size={16} color="#FFD93D" />}>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl px-4 py-3 text-[13px] font-bold text-white transition-all hover:bg-white/5"
              style={{
                background: "rgba(255,217,61,0.06)",
                border: "1px solid rgba(255,217,61,0.20)",
              }}
            >
              <span>Swagger /docs (כל ה-endpoints)</span>
              <ChevronLeft size={15} color="#FFD93D" />
            </a>
          </Section>
        )}

        {/* keeps refetchGame referenced (for lint) */}
        <div className="hidden" onClick={refetchGame} />
      </main>
      </div>
    </div>
  );
}

// ============================================================
// Section wrapper
// ============================================================
function Section({
  title, icon, children,
}: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: "rgba(20, 27, 45, 0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-extrabold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// ============================================================
// Toggle row
// ============================================================
function Toggle({
  label, description, value, onChange, disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-end transition-colors hover:bg-white/5 disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-[color:var(--color-muted)]">{description}</p>
        )}
      </div>
      <div
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{
          background: value ? "#06A77D" : "rgba(255,255,255,0.10)",
          boxShadow: value ? "inset 0 0 0 1px rgba(255,255,255,0.20)" : undefined,
        }}
      >
        <motion.div
          animate={{ x: value ? -22 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
        />
      </div>
    </button>
  );
}

function DisabledAction({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
        opacity: 0.5,
      }}
    >
      <span className="text-[13px] font-bold text-white">{label}</span>
      <span className="text-[10px] text-[color:var(--color-muted)]">{subtitle}</span>
    </div>
  );
}
