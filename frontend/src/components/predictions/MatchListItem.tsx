// שורת משחק ברשימת Predictions — דומה ל-MatchCard בעיצוב, אבל מותאמת לטאב ניחושים.
// מציגה: שעה, קבוצות, סטטוס ניחוש (לא נוחש / נוחש / נעול / חי).

import { Check, Lock } from "lucide-react";
import { getTeamInfo } from "@/lib/teams";
import type { Match, MatchPrediction } from "@/types";

// תרגום שלב לעברית — קצר, מתאים לכרטיס צר
function stageShortHe(match: Match): string {
  if (match.stage === "group" && match.group_name) return `בית ${match.group_name}`;
  const map: Record<string, string> = {
    r32: "סבב 32",
    r16: "שמינית",
    qf: "רבע",
    sf: "חצי",
    third_place: "מקומות 3-4",
    final: "גמר",
  };
  return map[match.stage] ?? match.stage;
}

type Props = {
  match: Match;
  prediction: MatchPrediction | null;
  hasDDActive: boolean; // יש ז'יטון DD פעיל על המשחק הזה
  onClick: () => void;
};

export function MatchListItem({ match, prediction, hasDDActive, onClick }: Props) {
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);

  const kickoff = new Date(match.kickoff_utc);
  const timeLocal = kickoff.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // קטגוריית סטטוס לעיצוב הכרטיס
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isLocked = match.predictions_locked;
  const hasPrediction = prediction !== null;

  // צבעי ה-border משתנים לפי המצב; ה-bg תמיד frosted glass כדי לראות את הרקע מאחורה
  let borderStyle = "1px solid rgba(255, 255, 255, 0.12)";
  let bgTint: string | undefined;

  if (isLive) {
    borderStyle = "1px solid rgba(230, 57, 70, 0.45)";
    bgTint = "linear-gradient(90deg, rgba(230,57,70,0.10), transparent 60%)";
  } else if (hasPrediction && !isFinished) {
    borderStyle = "1px solid rgba(6, 167, 125, 0.32)";
  } else if (isLocked && !hasPrediction) {
    borderStyle = "1px solid rgba(244, 162, 97, 0.32)";
  }

  return (
    <button
      onClick={onClick}
      className="relative block w-full overflow-hidden text-end no-tap transition-all hover:scale-[1.005]"
      style={{
        // זכוכית מטושטשת: רקע שקוף + backdrop blur כדי לראות את האצטדיון מאחורה
        background: "rgba(20, 27, 45, 0.32)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: borderStyle,
        borderRadius: 18,
        padding: "12px 14px",
        boxShadow: "0 8px 24px -12px rgba(0, 0, 0, 0.5)",
      }}
    >
      {bgTint && (
        <div className="pointer-events-none absolute inset-0" style={{ background: bgTint }} />
      )}

      <div className="relative z-10 flex items-center gap-3">
        {/* time / status */}
        <div className="shrink-0 text-center" style={{ minWidth: 50 }}>
          {isLive ? (
            <>
              <span className="text-[10px] font-bold text-[color:var(--color-brand-red)]">חי</span>
              <div className="num text-[9px] font-semibold text-[color:var(--color-muted)] mt-0.5">
                live
              </div>
            </>
          ) : isFinished ? (
            <>
              <span className="text-[10px] font-bold text-[color:var(--color-muted)]">סיים</span>
              {/* RTL alignment: away on left, home on right — matches team flag positions */}
              <div className="num text-[10px] font-extrabold text-white mt-0.5">
                {match.score_away}–{match.score_home}
              </div>
            </>
          ) : (
            <>
              <div className="num text-[11px] font-bold text-white">{timeLocal}</div>
              <div
                className="mt-0.5 text-[9.5px] font-semibold text-[color:var(--color-muted)]"
                style={{ letterSpacing: "0.05em" }}
              >
                {stageShortHe(match)}
              </div>
            </>
          )}
        </div>

        <div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />

        {/* teams */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-[13.5px] font-bold text-white">
          <span className="text-lg">{home.flag}</span>
          <span className="truncate">{home.he}</span>
          <span className="num text-[10px] font-medium text-[color:var(--color-muted)]">VS</span>
          <span className="truncate">{away.he}</span>
          <span className="text-lg">{away.flag}</span>
        </div>

        {/* status indicator */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          {hasDDActive && (
            <span className="text-[10px]" title="Double Down active">
              🔥
            </span>
          )}
          {isLocked && !hasPrediction ? (
            <Lock size={14} color="#F4A261" />
          ) : hasPrediction ? (
            <div className="flex items-center gap-1">
              <Check size={14} strokeWidth={3} color="#06A77D" />
              {prediction?.score_home !== null && prediction?.score_away !== null && (
                <span className="num text-[10px] font-bold" style={{ color: "#06A77D" }}>
                  {prediction.score_away}–{prediction.score_home}
                </span>
              )}
              {(prediction?.score_home === null || prediction?.score_away === null) && (
                <span className="num text-[10px] font-bold" style={{ color: "#06A77D" }}>
                  {prediction?.direction}
                </span>
              )}
            </div>
          ) : (
            <span
              className="rounded-full text-[10.5px] font-extrabold whitespace-nowrap"
              style={{
                background: "rgba(230, 57, 70, 0.10)",
                color: "#FF7A85",
                border: "1px solid rgba(230, 57, 70, 0.40)",
                padding: "4px 10px",
              }}
            >
              נחש ←
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
