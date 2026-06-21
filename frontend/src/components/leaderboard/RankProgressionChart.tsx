// Bumps Chart — תת-טאב "התקדמות" בעמוד /leaderboard.
//
// מציג איך הדירוג של חברי הקבוצה התפתח לאורך 5 המשחקים האחרונים (חלון מתגלגל).
// הקובץ הוא port של frontend/mockups/rank_progression.html — הלוגיקה המקורית
// נשמרה אחת לאחת והותאמה ל-React (useMemo + state במקום DOM ידני).
//
// Pure SVG, ללא ספריות charts. כל ההגדרות העיצוביות (פלטה, צבעי תוצאה, גלואו)
// תואמות בדיוק את ה-mockup שאושר.

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboardTimeline } from "@/hooks/useLeaderboardTimeline";
import type { TimelineMember, TimelineResult } from "@/types";

// ============================================================
// Constants — palette + result colors (מתואם 1:1 ל-mockup)
// ============================================================

const PALETTE = [
  "#E63946",
  "#7BB3F2",
  "#06A77D",
  "#FFD93D",
  "#C8D0DD",
  "#9BBAEA",
  "#FF7A85",
  "#A78BFA",
];

const ME_LINE_COLOR = "var(--color-brand-red)";

const RESULT_COLOR: Record<TimelineResult, string> = {
  exact: "#10D98C",
  direction: "#06734F",
  miss: "#E63946",
};

const RESULT_GLOW: Record<TimelineResult, string> = {
  exact: "drop-shadow(0 0 5px rgba(16,217,140,0.85))",
  direction: "drop-shadow(0 0 2px rgba(6,115,79,0.6))",
  miss: "drop-shadow(0 0 2px rgba(230,57,70,0.5))",
};

// ============================================================
// Chart geometry — ויב-בוקס קבוע, רספונסיבי דרך width:100%
// ============================================================

const VB_W = 360;
const VB_H = 280;
const PAD_LEFT = 30;
const PAD_RIGHT = 18;
const PAD_TOP = 14;
const PAD_BOTTOM = 42;
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM;

const MAJOR_RANKS = new Set([1, 5, 10, 15, 18]);

function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// ============================================================
// Main component
// ============================================================

export function RankProgressionChart() {
  const { user } = useAuth();
  const { data, loading, error } = useLeaderboardTimeline();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ----- Loading / error -----
  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[color:var(--color-muted)]">טוען התקדמות...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      </div>
    );
  }

  // ----- Empty state -----
  if (!data || data.checkpoints.length < 2 || data.members.length === 0) {
    return <EmptyState />;
  }

  return (
    <RankProgressionInner
      data={data}
      currentUserId={user?.id ?? null}
      highlightedId={highlightedId}
      onToggleHighlight={(id) =>
        setHighlightedId((cur) => (cur === id ? null : id))
      }
    />
  );
}

// ============================================================
// Inner — assumes data is non-empty
// ============================================================

type InnerProps = {
  data: { checkpoints: { match_id: number; label: string; sub_label: string }[]; members: TimelineMember[] };
  currentUserId: string | null;
  highlightedId: string | null;
  onToggleHighlight: (id: string) => void;
};

function RankProgressionInner({ data, highlightedId, onToggleHighlight }: InnerProps) {
  const { checkpoints, members } = data;
  const nX = checkpoints.length;
  const nMembers = members.length;

  // Stable index per member — לקביעת צבע מהפלטה. מסודר לפי user_id כדי שיהיה דטרמיניסטי.
  const memberIndex = useMemo(() => {
    const sorted = [...members].sort((a, b) => a.user_id.localeCompare(b.user_id));
    const map: Record<string, number> = {};
    sorted.forEach((m, i) => {
      map[m.user_id] = i;
    });
    return map;
  }, [members]);

  // ה-id של החבר ה"מסומן" — highlighted אם נבחר, אחרת "me"
  const meMember = useMemo(() => members.find((m) => m.is_me) ?? null, [members]);
  const labeledId = highlightedId ?? meMember?.user_id ?? null;
  const labeledMember = useMemo(
    () => (labeledId ? members.find((m) => m.user_id === labeledId) ?? null : null),
    [members, labeledId],
  );

  // Legend sorted by current rank (האחרון בחלון)
  const legendRows = useMemo(() => {
    return [...members]
      .map((m) => ({
        m,
        currentRank: m.ranks[m.ranks.length - 1] ?? 999,
        startRank: m.ranks[0] ?? 999,
      }))
      .sort((a, b) => a.currentRank - b.currentRank);
  }, [members]);

  // ----- Geometry helpers -----
  const xAt = (i: number) =>
    nX === 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (i / (nX - 1)) * PLOT_W;
  const yAt = (rank: number) =>
    nMembers === 1 ? PAD_TOP + PLOT_H / 2 : PAD_TOP + ((rank - 1) / (nMembers - 1)) * PLOT_H;

  return (
    <div>
      {/* ===== Section header (זהוב + hairline + window pill) ===== */}
      <div className="mb-3.5 px-1">
        <h2
          className="text-[12px] font-extrabold uppercase"
          style={{ color: "#FFD93D", letterSpacing: "0.24em" }}
        >
          שינוי מיקום
        </h2>
        <p className="mt-1 text-[11px] font-medium text-[color:var(--color-muted)]">
          איך הסתדרת ב-5 המשחקים האחרונים
        </p>
        <div
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{
            background: "rgba(255,217,61,0.08)",
            border: "1px solid rgba(255,217,61,0.25)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "#FFD93D",
              boxShadow: "0 0 6px rgba(255,217,61,0.8)",
            }}
          />
          <span
            className="text-[10.5px] font-bold"
            style={{ color: "#FFD93D" }}
          >
            חלון מתגלגל · מתעדכן אחרי כל משחק
          </span>
        </div>
        <div
          className="mt-2 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,217,61,0.45) 0%, rgba(255,217,61,0.08) 60%, transparent 100%)",
          }}
        />
      </div>

      {/* ===== Chart card ===== */}
      <div
        className="mb-3.5 overflow-hidden rounded-[18px] p-3.5"
        style={{
          background: "rgba(20,27,45,0.55)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
        >
          {/* Major rank gridlines */}
          {Array.from(MAJOR_RANKS).map((rank) => (
            <line
              key={`grid-${rank}`}
              x1={PAD_LEFT}
              y1={yAt(rank)}
              x2={VB_W - PAD_RIGHT}
              y2={yAt(rank)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          {/* Y-axis rank labels (1..N) */}
          {Array.from({ length: nMembers }, (_, idx) => idx + 1).map((rank) => {
            const isMajor = MAJOR_RANKS.has(rank) || nMembers <= 4;
            return (
              <text
                key={`yl-${rank}`}
                x={PAD_LEFT - 6}
                y={yAt(rank) + 3.5}
                textAnchor="end"
                fontSize={isMajor ? 10 : 8.5}
                fontWeight={isMajor ? 800 : 500}
                fontFamily="Rubik, sans-serif"
                fill={isMajor ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.42)"}
              >
                {rank}
              </text>
            );
          })}

          {/* X-axis labels — 2 שורות per checkpoint */}
          {checkpoints.map((cp, i) => {
            const x = xAt(i);
            return (
              <g key={`xl-${cp.match_id}`}>
                <text
                  x={x}
                  y={VB_H - 22}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fontFamily="Rubik, sans-serif"
                  fill="rgba(255,255,255,0.65)"
                >
                  {cp.label}
                </text>
                <text
                  x={x}
                  y={VB_H - 10}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontFamily="Rubik, sans-serif"
                  fill="rgba(255,255,255,0.35)"
                >
                  {cp.sub_label}
                </text>
              </g>
            );
          })}

          {/* "NOW" dashed line at right edge */}
          <line
            x1={xAt(nX - 1)}
            y1={PAD_TOP}
            x2={xAt(nX - 1)}
            y2={VB_H - PAD_BOTTOM}
            stroke="rgba(255,217,61,0.20)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />

          {/* ===== Pass 1: dimmed members (לא me, לא highlighted) ===== */}
          {members.map((m) => {
            if (m.is_me || m.user_id === highlightedId) return null;
            const color = colorForIndex(memberIndex[m.user_id] ?? 0);
            const polyPts = m.ranks
              .map((r, i) => `${xAt(i)},${yAt(r)}`)
              .join(" ");
            const isLabeled = m.user_id === labeledId;
            return (
              <g key={`dim-${m.user_id}`} opacity={0.28}>
                <polyline
                  points={polyPts}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {m.ranks.map((r, i) =>
                  isLabeled ? null : (
                    <circle
                      key={`dim-c-${m.user_id}-${i}`}
                      cx={xAt(i)}
                      cy={yAt(r)}
                      r={2}
                      fill={color}
                    />
                  ),
                )}
              </g>
            );
          })}

          {/* ===== Pass 2: bright members (me + highlighted) ===== */}
          {members.map((m) => {
            if (!(m.is_me || m.user_id === highlightedId)) return null;
            const color = m.is_me
              ? ME_LINE_COLOR
              : colorForIndex(memberIndex[m.user_id] ?? 0);
            const polyPts = m.ranks
              .map((r, i) => `${xAt(i)},${yAt(r)}`)
              .join(" ");
            const isLabeled = m.user_id === labeledId;
            return (
              <g key={`bright-${m.user_id}`} opacity={1}>
                <polyline
                  points={polyPts}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={
                    m.is_me
                      ? "drop-shadow(0 0 6px rgba(230,57,70,0.45))"
                      : undefined
                  }
                />
                {m.ranks.map((r, i) => {
                  if (isLabeled) return null;
                  return (
                    <circle
                      key={`bright-c-${m.user_id}-${i}`}
                      cx={xAt(i)}
                      cy={yAt(r)}
                      r={3.5}
                      fill={color}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* ===== Pass 3: result-colored circles for the labeled member ===== */}
          {labeledMember &&
            labeledMember.ranks.map((r, i) => {
              const result = labeledMember.results[i];
              return (
                <circle
                  key={`labeled-c-${i}`}
                  cx={xAt(i)}
                  cy={yAt(r)}
                  r={result === "exact" ? 4.5 : 4}
                  fill={RESULT_COLOR[result]}
                  stroke="#0A0E1A"
                  strokeWidth={1.2}
                  style={{ filter: RESULT_GLOW[result] }}
                />
              );
            })}

          {/* ===== Pass 4: point-value labels (pills) for labeled member ===== */}
          {labeledMember &&
            labeledMember.ranks.map((r, i) => {
              const cx = xAt(i);
              const cy = yAt(r);
              const value = labeledMember.pts[i];
              const valueStr = String(value);
              const labelAbove = cy > PAD_TOP + 18;
              const yOffset = labelAbove ? -10 : 14;
              const yText = cy + yOffset;
              const w = valueStr.length * 6 + 10;
              const h = 13;
              const xRect = cx - w / 2;
              const yRect = yText - h + 3;
              const pillColor = labeledMember.is_me
                ? ME_LINE_COLOR
                : colorForIndex(memberIndex[labeledMember.user_id] ?? 0);
              return (
                <g key={`pill-${i}`}>
                  <rect
                    x={xRect}
                    y={yRect}
                    width={w}
                    height={h}
                    rx={4}
                    fill="#0A0E1A"
                    stroke={pillColor}
                    strokeWidth={1}
                    opacity={0.95}
                  />
                  <text
                    x={cx}
                    y={yText}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={800}
                    fontFamily="Rubik, sans-serif"
                    fill={pillColor}
                  >
                    {valueStr}
                  </text>
                </g>
              );
            })}

          {/* ===== Pass 5: name caption near rightmost circle of labeled member ===== */}
          {labeledMember &&
            (() => {
              const lastR = labeledMember.ranks[labeledMember.ranks.length - 1];
              const lastCy = yAt(lastR);
              const nameX = xAt(nX - 1);
              const nameY =
                lastCy > VB_H - PAD_BOTTOM - 20 ? lastCy - 24 : lastCy + 30;
              const color = labeledMember.is_me
                ? ME_LINE_COLOR
                : colorForIndex(memberIndex[labeledMember.user_id] ?? 0);
              return (
                <text
                  x={nameX}
                  y={nameY}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={800}
                  fontFamily="Rubik, sans-serif"
                  fill={color}
                >
                  {(labeledMember.is_me ? "⭐ " : "") + labeledMember.username}
                </text>
              );
            })()}
        </svg>
      </div>

      {/* ===== Result color key (above legend) ===== */}
      <div
        className="mb-2.5 flex justify-center gap-4 rounded-xl px-3 py-2"
        style={{
          background: "rgba(20,27,45,0.30)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <ResultKeyItem color="#10D98C" glow label="מדויק" />
        <ResultKeyItem color="#06734F" label="כיוון" />
        <ResultKeyItem color="#E63946" label="החטיא" />
      </div>

      {/* ===== Legend ===== */}
      <div
        className="rounded-[20px] px-3 py-4"
        style={{
          background: "rgba(20,27,45,0.42)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mb-3.5 flex items-center justify-between px-1">
          <span
            className="text-[9.5px] font-semibold uppercase"
            style={{
              color: "var(--color-muted)",
              letterSpacing: "0.22em",
            }}
          >
            שינוי מיקום ב-5 משחקים
          </span>
          <span
            className="text-[9px] font-normal"
            style={{
              color: "rgba(138,147,166,0.55)",
              letterSpacing: "0.12em",
            }}
          >
            טאפ להדגשה
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          {legendRows.map(({ m, currentRank, startRank }) => {
            const delta = startRank - currentRank; // חיובי = שיפור
            const isHighlighted = m.user_id === highlightedId;
            const colorDot = m.is_me
              ? "var(--color-brand-red)"
              : colorForIndex(memberIndex[m.user_id] ?? 0);

            let deltaCls = "delta-flat";
            let deltaText: string = "— 0";
            let deltaColor = "rgba(138,147,166,0.6)";
            let deltaBg = "transparent";
            if (delta > 0) {
              deltaCls = "delta-up";
              deltaText = `▲ ${delta}`;
              deltaColor = "#58c19c";
              deltaBg = "rgba(6,167,125,0.10)";
            } else if (delta < 0) {
              deltaCls = "delta-down";
              deltaText = `▼ ${Math.abs(delta)}`;
              deltaColor = "#d99aa1";
              deltaBg = "rgba(255,122,133,0.08)";
            }

            // Row background
            let rowBg: string | undefined;
            if (m.is_me && isHighlighted) {
              rowBg =
                "linear-gradient(270deg, rgba(230,57,70,0.14), rgba(230,57,70,0.02) 60%)";
            } else if (m.is_me) {
              rowBg =
                "linear-gradient(270deg, rgba(230,57,70,0.08), rgba(230,57,70,0) 60%)";
            } else if (isHighlighted) {
              rowBg = "rgba(255,255,255,0.055)";
            }

            return (
              <button
                key={`row-${m.user_id}`}
                type="button"
                onClick={() => onToggleHighlight(m.user_id)}
                className="grid items-center gap-2.5 rounded-xl px-2.5 py-2 no-tap"
                style={{
                  gridTemplateColumns: "14px 26px 1fr auto auto",
                  background: rowBg,
                  transform: isHighlighted ? "translateX(2px)" : undefined,
                  transition: "background 180ms ease, transform 180ms ease",
                  borderTop: undefined,
                }}
                data-delta={deltaCls}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: colorDot, opacity: 0.85 }}
                />
                <span
                  className="num text-center text-[12.5px] font-bold"
                  style={{
                    color:
                      m.is_me || isHighlighted
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.85)",
                    letterSpacing: "-0.02em",
                    fontWeight: m.is_me || isHighlighted ? 800 : 700,
                  }}
                >
                  #{currentRank}
                </span>
                <span
                  className="truncate text-[12.5px] font-semibold text-end"
                  style={{
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: m.is_me ? 700 : 600,
                  }}
                >
                  {(m.is_me ? "⭐ " : "") + m.username}
                </span>
                <span
                  className="num text-[10.5px] font-bold"
                  style={{
                    color: deltaColor,
                    background: deltaBg,
                    padding: "2px 7px",
                    borderRadius: 8,
                    minWidth: 36,
                    textAlign: "center",
                    letterSpacing: "0.02em",
                  }}
                >
                  {deltaText}
                </span>
                <span
                  className="num text-end text-[11.5px] font-bold"
                  style={{
                    color:
                      m.is_me || isHighlighted
                        ? "#FFD93D"
                        : "rgba(255,217,61,0.85)",
                    minWidth: 30,
                    letterSpacing: "-0.01em",
                    fontWeight: m.is_me || isHighlighted ? 800 : 700,
                  }}
                >
                  {m.pts[m.pts.length - 1]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Result key item — small dot + label above the legend
// ============================================================

function ResultKeyItem({
  color,
  glow,
  label,
}: {
  color: string;
  glow?: boolean;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold"
      style={{ color: "rgba(255,255,255,0.70)" }}
    >
      <span
        className="h-[9px] w-[9px] rounded-full"
        style={{
          background: color,
          boxShadow: glow ? "0 0 6px rgba(16,217,140,0.7)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

// ============================================================
// Empty state — when fewer than 2 finished matches
// ============================================================

function EmptyState() {
  return (
    <div
      className="rounded-[18px] p-8 text-center"
      style={{
        background: "rgba(20,27,45,0.45)",
        border: "1px dashed rgba(255,255,255,0.12)",
      }}
    >
      <div
        className="mx-auto mb-3.5 grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: "rgba(255,217,61,0.10)",
          border: "1px solid rgba(255,217,61,0.20)",
        }}
      >
        <BarChart3 size={24} color="#FFD93D" />
      </div>
      <h3 className="m-0 mb-1.5 text-[14px] font-extrabold text-white">
        צריך לפחות 2 משחקים
      </h3>
      <p
        className="m-0 text-[11.5px]"
        style={{ color: "var(--color-muted)" }}
      >
        הגרף יוצג אחרי שיהיו מספיק משחקים שהסתיימו כדי להראות שינוי במיקום.
      </p>
    </div>
  );
}
