// טאב "Double Down" — ניהול 8 ז'יטוני ההכפלה.
// כל ז'יטון מציג: המחזור/שלב, סטטוס, ואם פעיל — המשחק שעליו הוא פעיל.
// פעולות:
// - ז'יטון "available" → הצגה בלבד עם הסבר ("בחר משחק בטאב משחקים")
// - ז'יטון "active" → הצגת המשחק + כפתור ביטול
// - ז'יטון "used" → הצגה עם הניקוד שצבר (read-only)

import { useEffect, useMemo, useState } from "react";
import { Flame, X } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { getTeamInfo } from "@/lib/teams";
import { useMyDoubleDownTokens } from "@/hooks/usePredictions";
import type { DoubleDownToken, Match, RoundKey } from "@/types";

// תוויות עברית לכל round_key
const ROUND_LABELS: Record<RoundKey, string> = {
  group_r1: "מחזור בתים 1",
  group_r2: "מחזור בתים 2",
  group_r3: "מחזור בתים 3",
  r32: "סבב 32",
  r16: "שמינית גמר",
  qf: "רבע גמר",
  sf: "חצי גמר",
  final: "גמר / מקומות 3-4",
};

export function DoubleDownManager() {
  const { tokens, loading, error, refresh } = useMyDoubleDownTokens();

  // שליפת פרטי המשחקים שעליהם יש ז'יטונים פעילים/בשימוש
  const [matchById, setMatchById] = useState<Record<number, Match>>({});

  useEffect(() => {
    const activeMatchIds = tokens
      .filter((t) => t.match_id !== null)
      .map((t) => t.match_id as number);
    if (activeMatchIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const fetched: Record<number, Match> = {};
        await Promise.all(
          activeMatchIds.map(async (id) => {
            const m = await api<Match>(`/api/matches/${id}`);
            fetched[id] = m;
          })
        );
        if (!cancelled) setMatchById((prev) => ({ ...prev, ...fetched }));
      } catch {
        // failed to fetch some match — לא קריטי, נמשיך
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens]);

  const stats = useMemo(() => {
    let available = 0;
    let active = 0;
    let used = 0;
    let totalEarned = 0;
    for (const t of tokens) {
      if (t.status === "available") available++;
      else if (t.status === "active") active++;
      else {
        used++;
        totalEarned += t.points_earned ?? 0;
      }
    }
    return { available, active, used, totalEarned };
  }, [tokens]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>;
  }
  if (error) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--color-error)" }}>
        {error}
      </p>
    );
  }

  return (
    <>
      {/* Hero card — סיכום סטטוס */}
      <section
        className="relative mb-4 overflow-hidden rounded-2xl p-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(230,57,70,0.18), rgba(177,46,61,0.12) 60%, rgba(20,27,45,0.32))",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(230,57,70,0.30)",
          boxShadow: "0 8px 24px -12px rgba(230,57,70,0.5)",
        }}
      >
        <div className="flex items-center gap-2">
          <Flame size={20} color="#E63946" fill="#E63946" />
          <h2 className="text-[16px] font-extrabold text-white">Double Down</h2>
        </div>
        <p className="mt-1 text-[12px] text-white/70">
          8 ז'יטונים — אחד לכל מחזור/שלב. הז'יטון מכפיל את הניקוד של המשחק שעליו הופעל ב-×2 (כולל בונוסים).
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="זמינים" value={stats.available} color="#F4F6FB" />
          <Stat label="פעילים" value={stats.active} color="#FFD93D" />
          <Stat label="ניוצלו" value={stats.used} color="#06A77D" />
        </div>

        {stats.totalEarned > 0 && (
          <p className="mt-3 text-center text-[12px] font-bold" style={{ color: "#06A77D" }}>
            סה"כ נקודות שצברת מבונוסי DD: <span className="num">{stats.totalEarned}</span>
          </p>
        )}
      </section>

      <p className="mb-3 px-1 text-[11.5px] text-[color:var(--color-muted)]">
        להפעלת ז'יטון: לך לטאב <span className="font-bold text-white">משחקים</span>, בחר משחק בשלב המתאים, והדלק את ה-toggle "הכפלת ניקוד" במודאל.
      </p>

      {/* רשימת 8 הז'יטונים */}
      <div className="flex flex-col gap-2.5">
        {tokens.map((token) => (
          <TokenRow
            key={token.id}
            token={token}
            match={token.match_id ? matchById[token.match_id] ?? null : null}
            onDeactivated={refresh}
          />
        ))}
      </div>
    </>
  );
}

// ============================================
// Stat tile
// ============================================
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="num text-[22px] font-extrabold num-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-bold text-[color:var(--color-muted)]">{label}</div>
    </div>
  );
}

// ============================================
// TokenRow — כרטיס בודד של ז'יטון
// ============================================
function TokenRow({
  token,
  match,
  onDeactivated,
}: {
  token: DoubleDownToken;
  match: Match | null;
  onDeactivated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    if (!confirm("לבטל את הפעלת הז'יטון? הוא יחזור לזמין.")) return;
    setBusy(true);
    try {
      await api(`/api/predictions/double-down/${token.round_key}`, { method: "DELETE" });
      onDeactivated();
    } catch (e) {
      if (e instanceof ApiException) {
        const detail =
          typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)
            ? (e.detail as { detail: string }).detail
            : "שגיאה";
        alert(detail);
      } else {
        alert("שגיאת רשת");
      }
    } finally {
      setBusy(false);
    }
  }

  // צבע border לפי סטטוס
  let borderColor = "rgba(255, 255, 255, 0.12)";
  let badgeColor = "#8A93A6";
  let badgeText = "זמין";
  if (token.status === "active") {
    borderColor = "rgba(255, 217, 61, 0.45)";
    badgeColor = "#FFD93D";
    badgeText = "פעיל";
  } else if (token.status === "used") {
    borderColor = "rgba(6, 167, 125, 0.40)";
    badgeColor = "#06A77D";
    badgeText = "מומש";
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-3.5"
      style={{
        background: "rgba(20, 27, 45, 0.32)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 8px 24px -12px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* round label + status badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Flame
              size={16}
              color={badgeColor}
              fill={token.status !== "available" ? badgeColor : "none"}
            />
            <p className="text-[13.5px] font-bold text-white">{ROUND_LABELS[token.round_key]}</p>
            <span
              className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase"
              style={{
                background: `${badgeColor}1A`,
                color: badgeColor,
                border: `1px solid ${badgeColor}33`,
                letterSpacing: "0.08em",
              }}
            >
              {badgeText}
            </span>
          </div>

          {/* match details if assigned */}
          {match && (
            <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-white/90">
              <span>{getTeamInfo(match.team_home).flag}</span>
              <span className="truncate">{getTeamInfo(match.team_home).he}</span>
              <span className="text-white/40">vs</span>
              <span className="truncate">{getTeamInfo(match.team_away).he}</span>
              <span>{getTeamInfo(match.team_away).flag}</span>
            </div>
          )}

          {token.status === "available" && (
            <p className="mt-1.5 text-[11px] text-[color:var(--color-muted)]">
              בחר משחק בטאב משחקים והפעל את ה-toggle
            </p>
          )}

          {token.status === "used" && token.points_earned !== null && (
            <p className="mt-1.5 text-[11px] font-bold" style={{ color: "#06A77D" }}>
              צבר <span className="num">{token.points_earned}</span> נקודות
            </p>
          )}
        </div>

        {/* deactivate button — רק אם פעיל */}
        {token.status === "active" && (
          <button
            onClick={handleDeactivate}
            disabled={busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full no-tap disabled:opacity-30"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
            }}
            aria-label="בטל"
          >
            <X size={14} color="#F4F6FB" />
          </button>
        )}
      </div>
    </div>
  );
}
