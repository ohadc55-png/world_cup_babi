// טבלת בית בודדת — header + שורות לפי דירוג חי (W/D/L/GD/Pts).
//
// 2 גרסאות:
//   - GroupStandingsCard: clickable (משמש ברשת ב-/bracket)
//   - GroupStandingsStatic: לא לחיץ (משמש בדף הפירוט /group/:name)

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getTeamInfo } from "@/lib/teams";
import type { GroupStanding, TeamStanding } from "@/types";

// Grid template אחיד ל-header ולשורות — כך כל עמודות הסטטיסטיקה
// מתיישבות זו תחת זו ללא תלות באורך שם הקבוצה.
// Column 1 = team info cluster (#+שם+דגל). Columns 2-6 = W/D/L/GD/Pts.
const STATS_GRID = "minmax(0, 1.7fr) repeat(5, minmax(0, 1fr))";

// ============================================================
// Inner table content — shared between card + static views
// ============================================================
function TableContent({ standing, large = false }: { standing: GroupStanding; large?: boolean }) {
  return (
    <>
      {/* Header */}
      <div
        className={`flex items-center justify-between ${large ? "px-4 py-3" : "px-3.5 py-2.5"}`}
        style={{
          background: "linear-gradient(135deg, rgba(255,217,61,0.10), rgba(230,57,70,0.06))",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className={`grid place-items-center rounded-md font-extrabold ${large ? "h-7 w-7 text-[13px]" : "h-6 w-6 text-[11px]"}`}
            style={{ background: "#FFD93D", color: "#1A1300" }}
          >
            {standing.group_name}
          </div>
          <span className={`font-bold text-white ${large ? "text-[14px]" : "text-[12.5px]"}`}>
            בית {standing.group_name}
          </span>
        </div>
        <span className="num text-[10px] text-[color:var(--color-muted)]">
          {standing.is_complete ? (
            <span className="font-bold text-[#06A77D]">סגור</span>
          ) : (
            <>
              <span className="font-bold text-white">{standing.matches_played}</span>
              /{standing.matches_total} משחקים
            </>
          )}
        </span>
      </div>

      {/* Column headers — אותו grid template כמו השורות, כדי שעמודות W/D/L/GD/Pts
          יהיו ישרות זו תחת זו ללא תלות באורך שם הקבוצה. */}
      <div
        className="grid items-center gap-2 px-3 py-1.5 text-[9px] font-bold text-[color:var(--color-muted)]"
        style={{
          gridTemplateColumns: STATS_GRID,
          background: "rgba(0,0,0,0.18)",
        }}
      >
        {/* Team info cluster — תופס את העמודה הראשונה של ה-grid */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-[18px] text-center" title="מיקום">#</span>
          <span title="קבוצה">קבוצה</span>
        </div>
        <span className="text-center" title="נצחונות">W</span>
        <span className="text-center" title="תיקו">D</span>
        <span className="text-center" title="הפסדים">L</span>
        <span className="text-center" title="הפרש שערים">GD</span>
        <span className="text-center" title="נקודות">Pts</span>
      </div>

      {/* Rows */}
      <div>
        {standing.table.map((row) => (
          <StandingRow
            key={row.team}
            row={row}
            groupComplete={standing.is_complete}
            large={large}
          />
        ))}
      </div>
    </>
  );
}

function StandingRow({
  row,
  groupComplete,
  large = false,
}: {
  row: TeamStanding;
  groupComplete: boolean;
  large?: boolean;
}) {
  const info = getTeamInfo(row.team);
  const advancing = row.position <= 2;
  const positionColor = advancing ? "#06A77D" : row.position === 3 ? "#FFD93D" : "#8A93A6";

  return (
    <div
      className={`grid items-center gap-2 px-3 ${large ? "py-2.5" : "py-2"}`}
      style={{
        gridTemplateColumns: STATS_GRID,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        background: advancing && groupComplete ? "rgba(6,167,125,0.05)" : undefined,
      }}
    >
      {/* Team info cluster — תופס את העמודה הראשונה של ה-grid (אותה רוחב לכל השורות) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="num w-[18px] text-center font-bold"
          style={{ color: positionColor, fontSize: large ? 11 : 10 }}
        >
          {row.position}
        </span>
        <span className={`min-w-0 truncate font-bold text-white ${large ? "text-[13.5px]" : "text-[12.5px]"}`}>
          {info.he}
        </span>
        <span className={large ? "text-[16px]" : "text-[14px]"}>{info.flag}</span>
      </div>
      <span
        className={`num text-center font-medium text-white/80 ${large ? "text-[12px]" : "text-[11px]"}`}
      >
        {row.won}
      </span>
      <span
        className={`num text-center font-medium text-white/80 ${large ? "text-[12px]" : "text-[11px]"}`}
      >
        {row.drawn}
      </span>
      <span
        className={`num text-center font-medium text-white/80 ${large ? "text-[12px]" : "text-[11px]"}`}
      >
        {row.lost}
      </span>
      <span
        className={`num text-center font-bold ${large ? "text-[12px]" : "text-[11px]"}`}
        style={{
          color: row.goal_diff > 0 ? "#06A77D" : row.goal_diff < 0 ? "#FF7A85" : "#C8D0DD",
        }}
      >
        {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
      </span>
      <span
        className={`num text-center font-extrabold num-tight ${large ? "text-[14px]" : "text-[12.5px]"}`}
        style={{ color: "#FFD93D" }}
      >
        {row.points}
      </span>
    </div>
  );
}

// ============================================================
// Public: clickable card (used in grid view)
// ============================================================
export function GroupStandingsCard({ standing }: { standing: GroupStanding }) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/group/${standing.group_name}`)}
      type="button"
      className="rounded-2xl overflow-hidden text-end no-tap transition-transform hover:scale-[1.005] active:scale-[0.995]"
      style={{
        background: "rgba(20,27,45,0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1.5px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
      }}
    >
      <TableContent standing={standing} />
    </motion.button>
  );
}

// ============================================================
// Public: non-clickable static (used in detail page)
// ============================================================
export function GroupStandingsStatic({ standing }: { standing: GroupStanding }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(20,27,45,0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1.5px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
      }}
    >
      <TableContent standing={standing} large />
    </div>
  );
}
