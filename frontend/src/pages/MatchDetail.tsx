// דף פרטי משחק — אחרי lock או finished מציג את ניחושי כל החברים.
//
// נגיש מ-`/match/:id`. לחיצה על משחק שכבר נעול / הסתיים מובילה לכאן.
// משחקים שעוד לא נעולים פותחים את המודאל הקיים (לא דרך הדף הזה).

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Lock, Zap, Clock, Check, X as XIcon, Minus,
} from "lucide-react";
import { useMatch, useMatchEvents, useMatchPredictions } from "@/hooks/useMatchDetail";
import { getTeamInfo } from "@/lib/teams";
import { formatScore, regularTimeDirection } from "@/lib/matchScore";
import { Logo } from "@/components/layout/Logo";
import type { MatchEvent, MemberPrediction, Match } from "@/types";

const STAGE_HE: Record<string, string> = {
  group: "שלב הבתים",
  r32: "סבב 32",
  r16: "שמינית גמר",
  qf: "רבע גמר",
  sf: "חצי גמר",
  third_place: "מקומות 3-4",
  final: "גמר",
};

export function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const matchId = id ? parseInt(id, 10) : null;
  const navigate = useNavigate();

  const { data: match, loading: matchLoading } = useMatch(matchId);
  const { data: predictions, loading: predsLoading } = useMatchPredictions(matchId);
  const { data: events } = useMatchEvents(matchId);

  const loading = matchLoading || predsLoading;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <p className="text-sm text-[color:var(--color-muted)]">טוען...</p>
      </div>
    );
  }
  if (!match) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-error)" }}>משחק לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
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
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5"
            aria-label="חזרה"
          >
            <ArrowRight size={18} color="#F4F6FB" />
          </button>
          <Logo size={24} showWordmark showTagline />
        </div>
      </header>

      <main className="px-5 pt-3 flex flex-col gap-5">
        {/* Match header */}
        <MatchHeaderCard match={match} />

        {/* Events timeline (live + finished only) */}
        {(match.status === "live" || match.status === "finished") && (
          <MatchEventsTimeline match={match} events={events ?? []} />
        )}

        {/* Predictions list */}
        {predictions && <PredictionsList match={match} predictions={predictions} />}
      </main>
    </div>
  );
}

// ============================================================
// MatchEventsTimeline — שערים + כרטיסים אדומים בעמוד פירוט משחק
// ============================================================

function MatchEventsTimeline({ match, events }: { match: Match; events: MatchEvent[] }) {
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);
  const sorted = [...events].sort((a, b) => a.minute_value - b.minute_value);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(20,27,45,0.65), rgba(20,27,45,0.40))",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-[10px] font-extrabold uppercase"
          style={{ color: "#FFD93D", letterSpacing: "0.22em" }}
        >
          אירועי משחק
        </span>
        <span className="text-[10px] text-[color:var(--color-muted)]">
          <span className="num font-bold text-white">{sorted.length}</span> סה"כ
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-[color:var(--color-muted)]">
          אין שערים עדיין
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((ev) => (
            <EventRow key={ev.id} event={ev} home={home} away={away} />
          ))}
        </div>
      )}
    </motion.section>
  );
}

function EventRow({
  event, home, away,
}: {
  event: MatchEvent;
  home: { flag: string; he: string };
  away: { flag: string; he: string };
}) {
  const isGoal = event.event_type === "goal";
  const team = event.team === "home" ? home : away;
  const accent = isGoal ? "#FFD93D" : "#FF7A85";

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(20,27,45,0.45)",
        border: `1px solid ${isGoal ? "rgba(255,217,61,0.18)" : "rgba(230,57,70,0.25)"}`,
      }}
    >
      {/* Minute — large, right side in RTL */}
      <span
        className="num shrink-0 text-end"
        style={{
          minWidth: 44,
          fontSize: 17,
          fontWeight: 800,
          color: accent,
          letterSpacing: "-0.02em",
        }}
      >
        {event.minute}
      </span>

      {/* Icon */}
      <span className="shrink-0 text-[18px]">{isGoal ? "⚽" : "🟥"}</span>

      {/* Flag */}
      <span className="shrink-0 text-[18px]">{team.flag}</span>

      {/* Player + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white">
          {event.primary_player}
          {isGoal && event.is_penalty && (
            <span
              className="ms-1.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold"
              style={{
                color: "#FFD93D",
                border: "1px solid rgba(255,217,61,0.50)",
                background: "rgba(255,217,61,0.10)",
              }}
            >
              פנדל
            </span>
          )}
          {isGoal && event.is_own_goal && (
            <span
              className="ms-1.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold"
              style={{
                color: "#FF7A85",
                border: "1px solid rgba(255,122,133,0.55)",
                background: "rgba(230,57,70,0.10)",
              }}
            >
              שער עצמי
            </span>
          )}
        </p>
        {isGoal && event.assister && (
          <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
            בישול: <span className="font-bold text-white/80">{event.assister}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MatchHeaderCard
// ============================================================
function MatchHeaderCard({ match }: { match: Match }) {
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  // תוצאה גם ב-live (מתעדכנת מ-ESPN כל ~2 דק׳)
  const score = (isFinished || isLive)
    ? formatScore(match.score_home, match.score_away, match.score_home_pen, match.score_away_pen)
    : null;

  const stageLabel = match.stage === "group" && match.group_name
    ? `בית ${match.group_name}`
    : STAGE_HE[match.stage] ?? match.stage;

  const kickoff = new Date(match.kickoff_utc);
  const kickoffLabel = kickoff.toLocaleString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(20,27,45,0.65), rgba(20,27,45,0.40))",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Top meta */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-[color:var(--color-muted)]">{stageLabel}</span>
        {isLive && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{
              background: "#E63946",
              boxShadow: "0 0 12px rgba(230,57,70,0.5)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            חי
          </span>
        )}
        {isFinished && (
          <span className="text-[10px] font-bold text-[color:var(--color-muted)]">סיים</span>
        )}
        {!isLive && !isFinished && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[color:var(--color-muted)]">
            <Lock size={10} />
            נעול
          </span>
        )}
      </div>

      {/* Teams + score - כל ציון מתחת לקבוצה שלו (חד-משמעי) */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {/* HOME (in RTL: visual right) */}
        <TeamSide
          team={home}
          score={score?.home}
          isPlayed={!!score}
        />

        {/* Separator */}
        <div className="flex flex-col items-center justify-center px-1" style={{ minHeight: 70 }}>
          <span className="text-[10px] font-bold text-[color:var(--color-muted)]">VS</span>
        </div>

        {/* AWAY (in RTL: visual left) */}
        <TeamSide
          team={away}
          score={score?.away}
          isPlayed={!!score}
        />
      </div>

      {/* בתחתית: שעון בזמן live, אחרת תאריך/שעת kickoff */}
      {isLive && match.display_clock ? (
        <p
          className="num mt-3 text-center text-[20px] font-extrabold"
          style={{
            color: "#FFD93D",
            textShadow: "0 0 18px rgba(255,217,61,0.35)",
            letterSpacing: "0.04em",
          }}
        >
          {match.display_clock}
        </p>
      ) : (
        <p className="num mt-3 text-center text-[11px] text-[color:var(--color-muted)]">
          <Clock size={10} className="inline -mt-0.5 me-1" />
          {kickoffLabel}
        </p>
      )}
    </motion.section>
  );
}

// ============================================================
// TeamSide — קבוצה + דגל + ציון תחתיה (חד-משמעי בRTL)
// ============================================================
function TeamSide({
  team, score, isPlayed,
}: {
  team: { flag: string; he: string };
  score?: string;
  isPlayed: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 text-center" style={{ minWidth: 0 }}>
      <span className="text-[40px] leading-none" style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}>
        {team.flag}
      </span>
      <span className="text-[13px] font-bold text-white truncate max-w-full">{team.he}</span>
      {isPlayed && score !== undefined && (
        <span
          className="num text-[32px] font-extrabold text-white num-tight"
          style={{
            lineHeight: 1,
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}


// ============================================================
// PredictionsList
// ============================================================
function PredictionsList({
  match, predictions,
}: { match: Match; predictions: MemberPrediction[] }) {
  const isFinished = match.status === "finished";
  const isVisible = match.predictions_locked || isFinished || match.status === "live";

  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);

  // actual direction (לסימון נכון/לא נכון) — לפי הזמן הרגיל, לא פנדלים
  const actualDir = useMemo(() => {
    if (!isFinished || match.score_home == null || match.score_away == null) return null;
    return regularTimeDirection(match.score_home, match.score_away);
  }, [match, isFinished]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="eyebrow">ניחושי החברים</span>
        <span className="text-[10.5px] font-medium text-[color:var(--color-muted)]">
          <span className="num font-bold text-white">{predictions.length}</span>{" "}
          {predictions.length === 1 ? "משתתף" : "משתתפים"}
        </span>
      </div>

      {!isVisible && (
        <div
          className="rounded-2xl p-4 text-center text-[12px] text-[color:var(--color-muted)]"
          style={{ background: "rgba(20,27,45,0.40)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Lock size={20} className="mx-auto mb-2" color="#9BBAEA" />
          ניחושי החברים יוצגו אחרי נעילת המשחק (30 דק׳ לפני kickoff).
        </div>
      )}

      {isVisible && predictions.length === 0 && (
        <p className="py-8 text-center text-[12px] text-[color:var(--color-muted)]">
          אף אחד לא ניחש את המשחק הזה
        </p>
      )}

      {isVisible && predictions.length > 0 && (
        <>
          {/* תזכורת איך לקרוא את הניחוש: דגלים + מספר תחת כל קבוצה */}
          <p className="mb-2 text-center text-[10px] text-[color:var(--color-muted)]">
            <span className="me-1">{home.flag}</span>
            <span className="font-bold text-white">{home.he}</span>
            <span className="mx-1.5 num">vs</span>
            <span className="font-bold text-white">{away.he}</span>
            <span className="ms-1">{away.flag}</span>
          </p>

          <div className="flex flex-col gap-1.5">
            {predictions.map((p) => (
              <PredictionRow
                key={p.user_id}
                pred={p}
                home={home}
                away={away}
                isFinished={isFinished}
                actualDir={actualDir}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================
// PredictionRow
// ============================================================
function PredictionRow({
  pred, home, away, isFinished, actualDir,
}: {
  pred: MemberPrediction;
  home: { flag: string; he: string };
  away: { flag: string; he: string };
  isFinished: boolean;
  actualDir: "home" | "away" | "draw" | null;
}) {
  const initial = pred.username[0]?.toUpperCase() ?? "?";
  const hasPrediction = pred.direction !== null;

  // האם הניחוש (כיוון) נכון? — מבוסס על כיוון הזמן הרגיל (תיקו = "draw")
  let directionOk: boolean | null = null;
  if (isFinished && pred.direction && actualDir) {
    const predSide =
      pred.direction === "1" ? "home" :
      pred.direction === "2" ? "away" :
      pred.direction === "X" ? "draw" : null;
    directionOk = predSide === actualDir;
  }

  // breakdown items
  const breakdown = pred.points_breakdown ?? {};
  const breakdownLabels: Record<string, string> = {
    direction: "כיוון",
    exact_uplift: "exact",
    draw_bonus: "תיקו",
    winner: "ניצח",
    exact_bonus: "exact",
  };

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: pred.is_me ? "rgba(255,217,61,0.08)" : "rgba(20,27,45,0.45)",
        border: pred.is_me
          ? "1.5px solid rgba(255,217,61,0.40)"
          : "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Avatar */}
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
        style={{
          background: "linear-gradient(135deg, #E63946, #1D3557)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        }}
      >
        {initial}
      </div>

      {/* Username + DD */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white">
          {pred.username}
          {pred.is_me && (
            <span className="ms-1 text-[10px] font-bold text-[#FFD93D]">(אתה)</span>
          )}
          {pred.has_double_down && (
            <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold"
              style={{ background: "rgba(6,167,125,0.18)", color: "#06A77D", border: "1px solid rgba(6,167,125,0.45)" }}
            >
              <Zap size={9} />×2
            </span>
          )}
        </p>
        {/* breakdown badges (אם נגמר) */}
        {isFinished && Object.keys(breakdown).length > 0 && (
          <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[9.5px] text-[color:var(--color-muted)]">
            {Object.entries(breakdown).map(([key, val]) => (
              <span key={key}>
                +{val} {breakdownLabels[key] ?? key}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Prediction - דגל + מספר לכל קבוצה (חד-משמעי) */}
      <div className="shrink-0">
        {!hasPrediction ? (
          <span className="text-[10.5px] font-medium text-[color:var(--color-muted)]">לא ניחש</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* HOME side (visual right in RTL) */}
            <span className="text-[13px]">{home.flag}</span>
            <span
              className="num text-[14px] font-extrabold"
              style={{
                color: directionOk === false ? "#FF7A85" : directionOk === true ? "#06A77D" : "#F4F6FB",
              }}
            >
              {pred.score_home}
            </span>
            <span className="text-white/30 text-[10px]">–</span>
            <span
              className="num text-[14px] font-extrabold"
              style={{
                color: directionOk === false ? "#FF7A85" : directionOk === true ? "#06A77D" : "#F4F6FB",
              }}
            >
              {pred.score_away}
            </span>
            <span className="text-[13px]">{away.flag}</span>
            {/* status icon */}
            {directionOk === true && <Check size={13} strokeWidth={3} color="#06A77D" />}
            {directionOk === false && <XIcon size={13} strokeWidth={3} color="#FF7A85" />}
            {directionOk === null && <Minus size={13} color="#8A93A6" />}
          </div>
        )}
      </div>

      {/* Points (if finished) — DD מכפיל ×2, מציגים את הסך הכולל */}
      {isFinished && (
        <div
          className="num shrink-0 grid h-9 min-w-[44px] place-items-center rounded-lg text-[14px] font-extrabold"
          style={{
            background: (pred.points_earned ?? 0) > 0
              ? "rgba(255,217,61,0.15)"
              : "rgba(255,255,255,0.04)",
            color: (pred.points_earned ?? 0) > 0 ? "#FFD93D" : "#8A93A6",
            border: (pred.points_earned ?? 0) > 0
              ? "1px solid rgba(255,217,61,0.40)"
              : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {pred.points_earned != null
            ? `+${pred.has_double_down ? pred.points_earned * 2 : pred.points_earned}`
            : "—"}
        </div>
      )}
    </div>
  );
}

