// כרטיס משחק יחיד ברשימת "המשחקים של היום"
// תומך ב-4 מצבים: לא נוחש / חי עכשיו / נוחש / הסתיים (כולל פנדלים)

import { Check } from "lucide-react";
import { formatScore } from "@/lib/matchScore";

export type MatchCardState =
  | { kind: "unpredicted" }
  | { kind: "live"; scoreHome: number; scoreAway: number; minute: string }
  | { kind: "predicted"; predHome: number; predAway: number }
  | {
      kind: "finished";
      scoreHome: number;
      scoreAway: number;
      pensHome?: number | null;
      pensAway?: number | null;
    };

export type MatchCardProps = {
  timeLocal: string; // "17:00"
  groupLabel: string; // "GROUP B"
  teamHome: { flag: string; nameHe: string };
  teamAway: { flag: string; nameHe: string };
  state: MatchCardState;
  onClick?: () => void;
};

export function MatchCard({ timeLocal, groupLabel, teamHome, teamAway, state, onClick }: MatchCardProps) {
  // צבעים לפי המצב
  let borderStyle = "1px solid rgba(255, 255, 255, 0.06)";
  let extraShadow: string | undefined;
  let bgTint: string | undefined;
  let dividerColor = "rgba(255,255,255,0.12)";

  if (state.kind === "live") {
    borderStyle = "1px solid rgba(230, 57, 70, 0.35)";
    extraShadow = "0 0 0 1px rgba(230,57,70,0.15), 0 12px 28px -16px rgba(230,57,70,0.5)";
    bgTint = "linear-gradient(90deg, rgba(230,57,70,0.06), transparent 60%)";
    dividerColor = "rgba(230,57,70,0.25)";
  } else if (state.kind === "predicted") {
    borderStyle = "1px solid rgba(6, 167, 125, 0.22)";
    bgTint = "linear-gradient(90deg, rgba(6,167,125,0.04), transparent 60%)";
    dividerColor = "rgba(6,167,125,0.25)";
  } else if (state.kind === "finished") {
    borderStyle = "1px solid rgba(255, 255, 255, 0.10)";
    dividerColor = "rgba(255,255,255,0.18)";
  }

  // פורמט תוצאות עם פנדלים (אם רלוונטי)
  const finishedScore = state.kind === "finished"
    ? formatScore(state.scoreHome, state.scoreAway, state.pensHome ?? null, state.pensAway ?? null)
    : null;

  return (
    <button
      onClick={onClick}
      className="relative block w-full overflow-hidden text-end no-tap transition-all hover:scale-[1.005]"
      style={{
        background: "rgba(20, 27, 45, 0.85)",
        border: borderStyle,
        borderRadius: 18,
        padding: "12px 14px",
        boxShadow: extraShadow,
      }}
    >
      {/* Tint overlay מבטא את המצב */}
      {bgTint && (
        <div className="pointer-events-none absolute inset-0" style={{ background: bgTint }} />
      )}

      <div className="relative z-10 flex items-center gap-3">
        {/* Time column (right) */}
        <div className="shrink-0 text-center" style={{ minWidth: 46 }}>
          {state.kind === "live" ? (
            <>
              <div className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-red)]"
                  style={{
                    animation: "livePulseInline 1.2s ease-out infinite",
                  }}
                />
                <span className="text-[10px] font-bold text-[color:var(--color-brand-red)]">חי</span>
              </div>
              <div
                className="num mt-0.5 text-[8.5px] font-semibold uppercase"
                style={{ letterSpacing: "0.18em", color: "#FF7A85" }}
              >
                {state.minute}
              </div>
            </>
          ) : (
            <>
              <div className="num text-[11px] font-bold text-white">{timeLocal}</div>
              <div
                className="num mt-0.5 text-[8.5px] font-semibold uppercase text-[color:var(--color-muted)]"
                style={{ letterSpacing: "0.18em" }}
              >
                {groupLabel}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px" style={{ background: dividerColor }} />

        {/* Teams (center) */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-[13.5px] font-bold text-white">
          <span className="text-lg">{teamHome.flag}</span>
          <span className="truncate">{teamHome.nameHe}</span>
          {state.kind === "live" ? (
            <>
              <span className="num text-[16px] font-extrabold text-white num-tight">{state.scoreHome}</span>
              <span className="num text-white/30">–</span>
              <span className="num text-[16px] font-extrabold text-white num-tight">{state.scoreAway}</span>
            </>
          ) : state.kind === "finished" && finishedScore ? (
            <>
              <span className="num text-[16px] font-extrabold text-white num-tight">{finishedScore.home}</span>
              <span className="num text-white/30">–</span>
              <span className="num text-[16px] font-extrabold text-white num-tight">{finishedScore.away}</span>
            </>
          ) : (
            <span className="num text-[10px] font-medium text-[color:var(--color-muted)]">VS</span>
          )}
          <span className="truncate">{teamAway.nameHe}</span>
          <span className="text-lg">{teamAway.flag}</span>
        </div>

        {/* State indicator (left) */}
        <div className="shrink-0">
          {state.kind === "unpredicted" && (
            <span
              className="rounded-full text-[11px] font-extrabold transition-colors hover:opacity-90"
              style={{
                background: "rgba(230, 57, 70, 0.10)",
                color: "#FF7A85",
                border: "1px solid rgba(230, 57, 70, 0.40)",
                padding: "6px 12px",
                whiteSpace: "nowrap",
              }}
            >
              נחש ←
            </span>
          )}
          {state.kind === "live" && (
            <span className="text-[11px] font-bold" style={{ color: "#FF7A85" }}>
              חי
            </span>
          )}
          {state.kind === "predicted" && (
            <div className="flex items-center gap-1.5">
              <Check size={14} strokeWidth={3} color="#06A77D" />
              <span className="num text-[10.5px] font-bold" style={{ color: "#06A77D" }}>
                {state.predHome}–{state.predAway}
              </span>
            </div>
          )}
          {state.kind === "finished" && (
            <span
              className="text-[10px] font-bold uppercase"
              style={{ color: "#8A93A6", letterSpacing: "0.12em" }}
            >
              סיים
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
