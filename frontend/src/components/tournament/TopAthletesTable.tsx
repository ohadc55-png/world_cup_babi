// טבלת מצטייני טורניר — מלך שערים או מלך בישולים.
// קומפוננט יחיד עם props {category} שבוחר באיזה hook לקרוא.
//
// עיצוב: dark glassmorphism עם הילה זהובה לטופ-3 (זהב/כסף/ארד) — תואם
// לסגנון של Leaderboard.

import { motion } from "framer-motion";
import { Medal } from "lucide-react";
import { useTopScorers, useTopAssisters } from "@/hooks/usePlayerStats";
import { getTeamInfo } from "@/lib/teams";
import type { PlayerStat } from "@/types";

type Category = "scorers" | "assisters";

export function TopAthletesTable({ category }: { category: Category }) {
  const isScorers = category === "scorers";
  const title = isScorers ? "מלך שערים" : "מלך בישולים";
  const valueLabel = isScorers ? "שערים" : "בישולים";

  // Two hooks — call both so React rules-of-hooks don't break when switching tabs
  const scorers = useTopScorers();
  const assisters = useTopAssisters();
  const { data, loading, error } = isScorers ? scorers : assisters;

  return (
    <section className="mt-1">
      <SectionHeader title={title} />

      {loading && (
        <p className="py-8 text-center text-[12px] text-[color:var(--color-muted)]">
          טוען...
        </p>
      )}

      {!loading && error && (
        <p className="py-8 text-center text-[12px]" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.map((p) => (
            <AthleteRow key={`${p.rank}-${p.player_name}`} entry={p} valueLabel={valueLabel} />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// SectionHeader — eyebrow זהוב + hairline (זהה ל-Leaderboard)
// ============================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 px-1">
      <h2
        className="text-[12px] font-extrabold uppercase"
        style={{ color: "#FFD93D", letterSpacing: "0.24em" }}
      >
        {title}
      </h2>
      <div
        className="mt-2 h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,217,61,0.45) 0%, rgba(255,217,61,0.08) 60%, transparent 100%)",
        }}
      />
    </div>
  );
}

// ============================================================
// AthleteRow — שורת מצטיין אחד
// ============================================================

function AthleteRow({ entry, valueLabel }: { entry: PlayerStat; valueLabel: string }) {
  const podium = entry.rank <= 3 ? podiumStyle(entry.rank as 1 | 2 | 3) : null;
  const team = entry.team_name ? getTeamInfo(entry.team_name) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min((entry.rank - 1) * 0.03, 0.3), duration: 0.3 }}
      className="grid items-center gap-3 rounded-2xl px-3 py-3 text-end"
      style={{
        gridTemplateColumns: "30px 1fr auto",
        background: podium?.bg ?? "rgba(20,27,45,0.42)",
        border: `1.5px solid ${podium?.border ?? "rgba(255,255,255,0.06)"}`,
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        boxShadow: podium ? `0 6px 18px -10px ${podium.glow}` : undefined,
      }}
    >
      {/* Rank */}
      <div className="flex flex-col items-center">
        <span
          className="num leading-none"
          style={{
            fontSize: podium ? 18 : 16,
            fontWeight: 800,
            color: podium?.text ?? "rgba(255,255,255,0.50)",
            letterSpacing: "-0.03em",
          }}
        >
          {entry.rank}
        </span>
      </div>

      {/* Name + team */}
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-bold leading-tight text-white">
          {team && <span className="me-1.5 text-[14px]">{team.flag}</span>}
          {entry.player_name}
        </p>
        {team && (
          <p className="mt-0.5 text-[10.5px] text-white/45">
            {team.he}
            {entry.matches > 0 && (
              <>
                <span className="mx-1.5 text-white/25">·</span>
                <span className="num font-bold text-white/70">{entry.matches}</span> משחקים
              </>
            )}
          </p>
        )}
      </div>

      {/* Value (goals / assists) */}
      <div className="text-end" style={{ direction: "ltr" }}>
        <span
          className="num font-extrabold leading-none num-tight"
          style={{
            fontSize: 22,
            color: podium?.text ?? "#FFD93D",
            letterSpacing: "-0.03em",
            textShadow: "0 0 14px rgba(255,217,61,0.25)",
          }}
        >
          {entry.value}
        </span>
        <span className="ms-1 text-[9.5px] font-medium text-white/50">{valueLabel}</span>
      </div>
    </motion.div>
  );
}

// ============================================================
// EmptyState
// ============================================================

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 px-6 text-center">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: "rgba(255,217,61,0.10)",
          border: "1px solid rgba(255,217,61,0.20)",
        }}
      >
        <Medal size={24} color="#FFD93D" />
      </div>
      <p className="text-[14px] font-bold text-white">עדיין אין מצטיינים</p>
      <p className="text-[11px] text-[color:var(--color-muted)]">
        המצטיינים יוצגו כשמשחקים יתחילו להניב שערים ובישולים.
      </p>
    </div>
  );
}

// ============================================================
// Podium colors (זהב / כסף / ארד)
// ============================================================

function podiumStyle(rank: 1 | 2 | 3) {
  if (rank === 1) {
    return {
      bg: "linear-gradient(90deg, rgba(255,217,61,0.18), rgba(255,217,61,0.05) 70%)",
      border: "rgba(255,217,61,0.55)",
      text: "#FFD93D",
      glow: "rgba(255,217,61,0.32)",
    };
  }
  if (rank === 2) {
    return {
      bg: "linear-gradient(90deg, rgba(200,208,221,0.15), rgba(200,208,221,0.04) 70%)",
      border: "rgba(200,208,221,0.45)",
      text: "#E2E8F0",
      glow: "rgba(200,208,221,0.22)",
    };
  }
  return {
    bg: "linear-gradient(90deg, rgba(205,135,85,0.18), rgba(205,135,85,0.05) 70%)",
    border: "rgba(205,135,85,0.48)",
    text: "#E8B58A",
    glow: "rgba(205,135,85,0.26)",
  };
}
