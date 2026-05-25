// Modal לניחוש משחק יחיד.
//
// UX מעודכן (לפי משוב המשתמש):
// - בלי picker 1/X/2 — ישר ניחוש מדויק (steppers לציון של כל קבוצה).
// - הכיוון נגזר אוטומטית מהציון (אם home > away → ניצחון בית, וכו').
// - גם אם הציון לא מדויק, הכיוון עדיין נחשב (3 נק'); ציון מדויק = 6 נק' סה"כ.
//
// מושגים חדשים:
// - createPortal: רינדור רכיב במקום אחר ב-DOM (מחוץ להיררכיית האב), נכון למודלים.
// - AnimatePresence: מאפשר animation גם ב-exit (כשהמודל נסגר).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Flame } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { getTeamInfo } from "@/lib/teams";
import type { Direction, DoubleDownToken, Match, MatchPrediction, RoundKey } from "@/types";

type Props = {
  match: Match | null;
  existing: MatchPrediction | null;
  ddTokens: DoubleDownToken[];
  onSaved: (p: MatchPrediction) => void;
  onDDChanged: () => void;
  onClose: () => void;
};

// ממיר stage + group_round של משחק ל-round_key של DD שמתאים
function ddRoundKeyForMatch(match: Match): RoundKey | null {
  if (match.stage === "group") {
    if (match.group_round === 1) return "group_r1";
    if (match.group_round === 2) return "group_r2";
    if (match.group_round === 3) return "group_r3";
    return null;
  }
  if (match.stage === "third_place" || match.stage === "final") return "final";
  if (match.stage === "r32") return "r32";
  if (match.stage === "r16") return "r16";
  if (match.stage === "qf") return "qf";
  if (match.stage === "sf") return "sf";
  return null;
}

// תרגום stage לעברית למודאל
function stageHe(match: Match): string {
  if (match.stage === "group") {
    return `שלב הבתים · בית ${match.group_name} · מחזור ${match.group_round}`;
  }
  const map: Record<string, string> = {
    r32: "סבב 32",
    r16: "שמינית גמר",
    qf: "רבע גמר",
    sf: "חצי גמר",
    third_place: "מקומות 3-4",
    final: "גמר",
  };
  return map[match.stage] ?? match.stage;
}

// גוזר את הכיוון מהציון (1=ניצחון בית, X=תיקו, 2=ניצחון חוץ)
function deriveDirection(home: number, away: number): Direction {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

// תיאור הכיוון בעברית
function describeDirection(direction: Direction, homeName: string, awayName: string): string {
  if (direction === "1") return `ניצחון ${homeName}`;
  if (direction === "2") return `ניצחון ${awayName}`;
  return "תיקו";
}

export function MatchPredictionModal({
  match,
  existing,
  ddTokens,
  onSaved,
  onDDChanged,
  onClose,
}: Props) {
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // אתחול הציונים לפי ניחוש קיים (אם יש) — אחרת 0:0
  useEffect(() => {
    if (existing && existing.score_home !== null && existing.score_away !== null) {
      setScoreHome(existing.score_home);
      setScoreAway(existing.score_away);
    } else if (existing) {
      // ניחוש בעבר עם כיוון בלבד — נציג 1:0 / 0:0 / 0:1 כברירת מחדל
      if (existing.direction === "1") {
        setScoreHome(1);
        setScoreAway(0);
      } else if (existing.direction === "2") {
        setScoreHome(0);
        setScoreAway(1);
      } else {
        setScoreHome(0);
        setScoreAway(0);
      }
    } else {
      setScoreHome(0);
      setScoreAway(0);
    }
    setError(null);
  }, [existing, match?.id]);

  const ddInfo = useMemo(() => {
    if (!match) return null;
    const key = ddRoundKeyForMatch(match);
    if (!key) return null;
    const token = ddTokens.find((t) => t.round_key === key);
    if (!token) return null;
    return {
      key,
      token,
      activeOnThisMatch: token.status === "active" && token.match_id === match.id,
      activeOnOtherMatch:
        token.status === "active" && token.match_id !== null && token.match_id !== match.id,
      used: token.status === "used",
    };
  }, [match, ddTokens]);

  async function toggleDoubleDown() {
    if (!match || !ddInfo) return;
    try {
      if (ddInfo.activeOnThisMatch) {
        await api(`/api/predictions/double-down/${ddInfo.key}`, { method: "DELETE" });
      } else {
        await api(`/api/predictions/double-down/${ddInfo.key}/activate`, {
          method: "PUT",
          body: { match_id: match.id },
        });
      }
      onDDChanged();
    } catch (e) {
      if (e instanceof ApiException) {
        const detail =
          typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)
            ? (e.detail as { detail: string }).detail
            : "שגיאה";
        setError(detail);
      } else {
        setError("שגיאת רשת");
      }
    }
  }

  async function handleSubmit() {
    if (!match) return;
    setError(null);
    setSubmitting(true);
    try {
      const direction = deriveDirection(scoreHome, scoreAway);
      const saved = await api<MatchPrediction>(`/api/predictions/matches/${match.id}`, {
        method: "PUT",
        body: { direction, score_home: scoreHome, score_away: scoreAway },
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiException) {
        const detail =
          typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)
            ? (e.detail as { detail: string }).detail
            : `שגיאה ${e.status}`;
        setError(typeof detail === "string" ? detail : "שגיאה");
      } else {
        setError("שגיאת רשת");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!match) return null;

  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);
  const kickoff = new Date(match.kickoff_utc);
  const kickoffLabel = kickoff.toLocaleString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const locked = match.predictions_locked;

  // הכיוון הנוכחי לפי הציונים
  const currentDirection = deriveDirection(scoreHome, scoreAway);
  const directionLabel = describeDirection(currentDirection, home.he, away.he);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-[100] no-tap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      />
      <motion.div
        key="modal"
        className="fixed inset-x-0 bottom-0 z-[101] no-tap overflow-hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.7)",
          maxHeight: "92dvh",
        }}
      >
        {/* ============= BACKGROUND IMAGE (wc7 balls — vertical) ============= */}
        {/* התמונה האנכית מכסה את כל המודאל. כיוון שגם התמונה וגם המודאל אנכיים, */}
        {/* החיתוך מינימלי (~20px מכל צד). חשיפה 65% להקלת קריאות הטקסט. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src="/img/wc7.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: 0.65,
            }}
          />
        </div>

        {/* close button — נשאר קבוע מעל הרקע */}
        <button
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5"
          onClick={onClose}
          aria-label="סגור"
          style={{
            background: "rgba(0,0,0,0.32)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <X size={18} color="#F4F6FB" />
        </button>

        {/* ============= SCROLLABLE CONTENT (above bg) ============= */}
        <div
          className="relative z-10 overflow-y-auto"
          style={{
            maxHeight: "92dvh",
            paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          }}
        >
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.30)" }} />
          </div>

        <div className="px-5 pt-6">
          {/* Stage title — לבן בהיר עם text-shadow לקריאות על תמונה צבעונית */}
          <p
            className="text-center text-[10px] font-bold uppercase"
            style={{
              color: "rgba(255, 255, 255, 0.90)",
              letterSpacing: "0.24em",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)",
            }}
          >
            {stageHe(match)}
          </p>

          <p
            className="mt-3 text-center text-[12px] font-medium"
            style={{
              color: "rgba(255, 255, 255, 0.82)",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)",
            }}
          >
            {kickoffLabel}
            {match.venue && <span> · {match.venue}</span>}
          </p>

          {locked && (
            <div
              className="mt-4 rounded-2xl px-4 py-3 text-center text-[12px] font-semibold"
              style={{
                background: "rgba(244,162,97,0.10)",
                color: "#F4A261",
                border: "1px solid rgba(244,162,97,0.30)",
              }}
            >
              ⏰ הניחושים נעולים — לא ניתן לעדכן
            </div>
          )}

          {/* SCORE PREDICTION — ישר לעיקר */}
          <div className="mt-6">
            <p
              className="mb-4 text-center text-[10px] font-bold uppercase"
              style={{
                color: "rgba(255, 255, 255, 0.90)",
                letterSpacing: "0.24em",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)",
              }}
            >
              הניחוש שלך
            </p>

            {/* Teams + VS — דגלים גדולים ושמות בעברית, ממוקם ישירות מעל הסטפרים */}
            <div className="mb-3 flex items-center justify-around">
              <div className="flex-1 text-center">
                <div
                  className="mb-1.5 text-5xl"
                  style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}
                >
                  {home.flag}
                </div>
                <div
                  className="text-[15px] font-bold leading-tight text-white"
                  style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)" }}
                >
                  {home.he}
                </div>
              </div>
              <div
                className="num num-tight text-2xl font-extrabold text-white/60"
                style={{ minWidth: 40, textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)" }}
              >
                VS
              </div>
              <div className="flex-1 text-center">
                <div
                  className="mb-1.5 text-5xl"
                  style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}
                >
                  {away.flag}
                </div>
                <div
                  className="text-[15px] font-bold leading-tight text-white"
                  style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)" }}
                >
                  {away.he}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-around">
              <ScoreStepper value={scoreHome} onChange={setScoreHome} disabled={locked} />
              <span className="num text-3xl font-bold text-white/30 num-tight">–</span>
              <ScoreStepper value={scoreAway} onChange={setScoreAway} disabled={locked} />
            </div>

            {/* Live derived label - מציג בזמן אמת מה ניחשת — מובלט עם glow צבעוני */}
            <div className="mt-4 flex justify-center">
              <div
                className="rounded-full px-5 py-2 text-[14px] font-extrabold"
                style={{
                  background:
                    currentDirection === "X"
                      ? "rgba(255, 217, 61, 0.28)"
                      : currentDirection === "1"
                      ? "rgba(230, 57, 70, 0.32)"
                      : "rgba(29, 53, 87, 0.55)",
                  color:
                    currentDirection === "X"
                      ? "#FFE57A"
                      : currentDirection === "1"
                      ? "#FFB1B8"
                      : "#C5D7F4",
                  border: `1.5px solid ${
                    currentDirection === "X"
                      ? "rgba(255, 217, 61, 0.65)"
                      : currentDirection === "1"
                      ? "rgba(230, 57, 70, 0.65)"
                      : "rgba(155, 186, 234, 0.65)"
                  }`,
                  backdropFilter: "blur(10px) saturate(160%)",
                  WebkitBackdropFilter: "blur(10px) saturate(160%)",
                  boxShadow:
                    currentDirection === "X"
                      ? "0 0 24px -4px rgba(255, 217, 61, 0.55), 0 6px 16px -6px rgba(255, 217, 61, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                      : currentDirection === "1"
                      ? "0 0 24px -4px rgba(230, 57, 70, 0.55), 0 6px 16px -6px rgba(230, 57, 70, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                      : "0 0 24px -4px rgba(29, 53, 87, 0.7), 0 6px 16px -6px rgba(29, 53, 87, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                  textShadow: "0 1px 4px rgba(0, 0, 0, 0.45)",
                  letterSpacing: "0.01em",
                }}
              >
                {directionLabel}
              </div>
            </div>
          </div>

          {/* Double Down toggle — רקע כהה זכוכית כדי לבלוט על התמונה */}
          {ddInfo && (
            <div
              className="mt-6 rounded-2xl p-4"
              style={{
                background: ddInfo.activeOnThisMatch
                  ? "rgba(230, 57, 70, 0.32)"
                  : "rgba(10, 14, 26, 0.65)",
                backdropFilter: "blur(14px) saturate(140%)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
                border: `1px solid ${
                  ddInfo.activeOnThisMatch
                    ? "rgba(230, 57, 70, 0.55)"
                    : "rgba(255, 255, 255, 0.18)"
                }`,
                boxShadow: "0 6px 20px -8px rgba(0, 0, 0, 0.60)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Flame
                    size={20}
                    color={ddInfo.activeOnThisMatch ? "#E63946" : "#8A93A6"}
                    fill={ddInfo.activeOnThisMatch ? "#E63946" : "none"}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white">הכפלת ניקוד</p>
                    <p className="text-[11px]" style={{ color: "rgba(255, 255, 255, 0.78)" }}>
                      {ddInfo.used && "מומש כבר — לא ניתן להפעיל"}
                      {!ddInfo.used && ddInfo.activeOnThisMatch && "פעיל על המשחק הזה ⚡"}
                      {!ddInfo.used &&
                        ddInfo.activeOnOtherMatch &&
                        "פעיל על משחק אחר — בטל שם קודם"}
                      {!ddInfo.used &&
                        !ddInfo.activeOnThisMatch &&
                        !ddInfo.activeOnOtherMatch &&
                        "הכפל את הניקוד ×2 (כולל בונוסים)"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleDoubleDown}
                  disabled={locked || ddInfo.used || ddInfo.activeOnOtherMatch}
                  className="relative h-6 w-11 rounded-full transition-colors shrink-0"
                  style={{
                    background: ddInfo.activeOnThisMatch ? "#E63946" : "rgba(255,255,255,0.10)",
                    opacity: locked || ddInfo.used || ddInfo.activeOnOtherMatch ? 0.4 : 1,
                  }}
                  aria-label="Double Down"
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                    style={{ left: ddInfo.activeOnThisMatch ? 22 : 2 }}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              className="mt-4 text-center text-sm font-medium"
              style={{ color: "var(--color-error)" }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={locked || submitting}
            className="mt-6 h-14 w-full rounded-2xl text-[16px] font-extrabold text-white transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #E63946, #B12E3D)",
              boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
            }}
          >
            {submitting ? "שומר..." : existing ? "עדכן ניחוש" : "שמור ניחוש"}
          </button>

          <p
            className="mt-3 text-center text-[10px] font-medium"
            style={{
              color: "rgba(255, 255, 255, 0.78)",
              textShadow: "0 2px 6px rgba(0, 0, 0, 0.5)",
            }}
          >
            ניחוש מדויק = 6 נק' · רק כיוון נכון = 3 נק'
          </p>
        </div>
        </div>
        {/* end z-10 scrollable content */}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ============================================
// Score stepper — מספר עם +/-
// (השם והדגל של הקבוצה מופיעים מעל ב-Teams row, אין צורך בכפילות)
// ============================================

function ScoreStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* + מספר - — עיגולים כהים (zכוכית) כדי לבלוט על הרקע הצבעוני */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value === 0}
          className="grid h-10 w-10 place-items-center rounded-full no-tap disabled:opacity-30"
          style={{
            background: "rgba(10, 14, 26, 0.70)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            boxShadow: "0 4px 12px -4px rgba(0, 0, 0, 0.55)",
          }}
          aria-label="הורד"
        >
          <Minus size={18} color="#F4F6FB" />
        </button>
        <span
          className="num text-4xl font-extrabold text-white"
          style={{
            minWidth: 36,
            textAlign: "center",
            letterSpacing: "-0.04em",
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.6)",
          }}
        >
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(15, value + 1))}
          disabled={disabled || value === 15}
          className="grid h-10 w-10 place-items-center rounded-full no-tap disabled:opacity-30"
          style={{
            background: "rgba(10, 14, 26, 0.70)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            boxShadow: "0 4px 12px -4px rgba(0, 0, 0, 0.55)",
          }}
          aria-label="העלה"
        >
          <Plus size={18} color="#F4F6FB" />
        </button>
      </div>
    </div>
  );
}

