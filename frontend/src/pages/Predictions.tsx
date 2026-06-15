// המסך הראשי לניחושים — 5 טאבים: משחקים / בתים / מצטיינים / Double Down / פלייאוף.
// לעת עתה רק טאב "משחקים" פעיל; השאר placeholder (Chunks 6-7).

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiException } from "@/lib/api";
import { useMyDoubleDownTokens, useMyMatchPredictions } from "@/hooks/usePredictions";
import { useAllMatches } from "@/hooks/useMatches";
import { Logo } from "@/components/layout/Logo";
import { MatchPredictionModal } from "@/components/predictions/MatchPredictionModal";
import { MatchListItem } from "@/components/predictions/MatchListItem";
import { GroupStandingsPicker } from "@/components/predictions/GroupStandingsPicker";
import { AwardsPicker } from "@/components/predictions/AwardsPicker";
import { DoubleDownManager } from "@/components/predictions/DoubleDownManager";
import type { Match, Stage } from "@/types";
import { useEffect } from "react";

type Tab = "matches" | "groups" | "awards" | "double_down" | "knockout";

const TABS: { key: Tab; label: string; enabled: boolean }[] = [
  { key: "matches", label: "משחקי בתים", enabled: true },
  { key: "groups", label: "בתים", enabled: true },
  { key: "knockout", label: "פלייאוף", enabled: true },
  { key: "awards", label: "מצטיינים", enabled: true },
  { key: "double_down", label: "Double Down", enabled: true },
];

const VALID_TABS: Tab[] = ["matches", "groups", "awards", "double_down", "knockout"];

export function Predictions() {
  const [searchParams, setSearchParams] = useSearchParams();
  // קריאת הטאב מה-URL — מאפשרת שחזור מצב אחרי back-navigation מ-/match/:id
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "matches";

  function setActiveTab(t: Tab) {
    // עדכון בלי לדרוס params אחרים (sub) — נאפס sub כשמחליפים tab ראשי
    setSearchParams({ tab: t }, { replace: false });
  }

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      {/* ============== BACKGROUND IMAGE (fixed, atmospheric) ============== */}
      {/* תמונת אצטדיון מלא — fixed כדי שלא תזוז בגלילה. */}
      {/* חשיפה: 40% opacity, ללא blur, brightness טבעי - כדי שהתמונה תזרח באמת. */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          backgroundImage: "url(/img/game.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          filter: "brightness(0.95) saturate(1.10)",
          opacity: 0.4,
        }}
      />
      {/* Overlay כהה רק בקצוות (header למעלה, bottom-nav למטה) — האמצע נשאר פתוח */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.75) 0%, rgba(10,14,26,0.10) 18%, rgba(10,14,26,0.05) 75%, rgba(10,14,26,0.92) 100%)",
        }}
      />

      {/* ============== CONTENT (z-10 to layer above bg) ============== */}
      <div className="relative z-10">

      {/* HEADER */}
      <header
        className="sticky top-0 z-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.85), rgba(10,14,26,0.45) 70%, transparent)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          paddingTop: "max(14px, env(safe-area-inset-top))",
        }}
      >
        <div className="flex h-11 items-center justify-between px-5">
          <div /> {/* spacer */}
          <Logo size={24} showWordmark />
        </div>

        {/* Tabs strip — pills זכוכית מטושטשת (frosted glass) */}
        <div className="px-5 pb-2 pt-1 overflow-x-auto scrollbar-hidden">
          <div className="flex gap-1.5">
            {TABS.map(({ key, label, enabled }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => enabled && setActiveTab(key)}
                  disabled={!enabled}
                  className="relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-tap transition-all disabled:opacity-40"
                  style={{
                    background: isActive ? "#E63946" : "rgba(255,255,255,0.08)",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.85)",
                    border: `1px solid ${isActive ? "#E63946" : "rgba(255,255,255,0.14)"}`,
                    backdropFilter: isActive ? undefined : "blur(16px) saturate(140%)",
                    WebkitBackdropFilter: isActive ? undefined : "blur(16px) saturate(140%)",
                    boxShadow: isActive ? "0 8px 20px -8px rgba(230,57,70,0.6)" : undefined,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* TAB CONTENT */}
      <main className="px-5 pt-3">
        {activeTab === "matches" && <MatchesTab />}
        {activeTab === "groups" && <GroupStandingsPicker />}
        {activeTab === "awards" && <AwardsPicker />}
        {activeTab === "double_down" && <DoubleDownManager />}
        {activeTab === "knockout" && <KnockoutTab />}
      </main>

      </div>
      {/* end z-10 content wrapper */}
    </div>
  );
}

// ========================================================
// טאב משחקים — רשימת כל המשחקים, אפשר ללחוץ ולנחש
// ========================================================

type GroupRound = 1 | 2 | 3;

function MatchesTab() {
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // sub-tab (מחזור 1/2/3) נשמר ב-URL
  const subParam = parseInt(searchParams.get("sub") ?? "", 10);
  const selectedRound: GroupRound = (subParam === 1 || subParam === 2 || subParam === 3) ? subParam : 1;
  function setSelectedRound(r: GroupRound) {
    setSearchParams({ tab: "matches", sub: String(r) }, { replace: false });
  }

  const { byMatchId, setLocalPrediction } = useMyMatchPredictions();
  const { tokens, refresh: refreshDD } = useMyDoubleDownTokens();

  // click handler: אם המשחק נעול/חי/סיים -> נווט לדף פרטי המשחק
  function handleMatchClick(m: Match) {
    if (m.predictions_locked || m.status === "live" || m.status === "finished") {
      navigate(`/match/${m.id}`);
    } else {
      setOpenMatch(m);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // שולפים את כל משחקי שלב הבתים (לא רק upcoming — כדי שגם מחזורים שעברו יוצגו)
        const matches = await api<Match[]>("/api/matches?stage=group");
        if (!cancelled) setAllMatches(matches);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // סינון לפי מחזור נבחר
  const matchesInRound = useMemo(() => {
    return allMatches.filter((m) => m.group_round === selectedRound);
  }, [allMatches, selectedRound]);

  // סטטיסטיקות לכל מחזור (לתצוגה בתת-טאבים)
  const roundStats = useMemo(() => {
    const stats: Record<GroupRound, { total: number; predicted: number }> = {
      1: { total: 0, predicted: 0 },
      2: { total: 0, predicted: 0 },
      3: { total: 0, predicted: 0 },
    };
    for (const m of allMatches) {
      const r = m.group_round as GroupRound | null;
      if (r === 1 || r === 2 || r === 3) {
        stats[r].total++;
        if (byMatchId[m.id]) stats[r].predicted++;
      }
    }
    return stats;
  }, [allMatches, byMatchId]);

  // קיבוץ משחקים לפי יום בתוך המחזור הנבחר
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matchesInRound) {
      const date = new Date(m.kickoff_utc);
      const key = date.toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [matchesInRound]);

  // מפה: match_id → האם יש ז'יטון DD פעיל עליו
  const ddActiveByMatch = useMemo(() => {
    const s = new Set<number>();
    for (const t of tokens) {
      if (t.status === "active" && t.match_id) s.add(t.match_id);
    }
    return s;
  }, [tokens]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>;
  }
  if (error) {
    return <p className="py-12 text-center text-sm" style={{ color: "var(--color-error)" }}>{error}</p>;
  }
  if (allMatches.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
        אין משחקים
      </p>
    );
  }

  return (
    <>
      {/* === Sub-tabs: 3 מחזורי הבתים === */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {([1, 2, 3] as GroupRound[]).map((round) => {
          const isActive = selectedRound === round;
          const stats = roundStats[round];
          return (
            <button
              key={round}
              onClick={() => setSelectedRound(round)}
              className="relative rounded-2xl px-2 py-2.5 no-tap transition-all"
              style={{
                background: isActive
                  ? "linear-gradient(135deg, rgba(230,57,70,0.18), rgba(230,57,70,0.08))"
                  : "rgba(20,27,45,0.50)",
                border: `1.5px solid ${isActive ? "rgba(230,57,70,0.50)" : "rgba(255,255,255,0.08)"}`,
                backdropFilter: "blur(12px) saturate(140%)",
                WebkitBackdropFilter: "blur(12px) saturate(140%)",
              }}
            >
              <p className={`text-[12.5px] font-extrabold ${isActive ? "text-white" : "text-white/85"}`}>
                מחזור <span className="num">{round}</span>
              </p>
              <p className="num mt-0.5 text-[10px] text-[color:var(--color-muted)]">
                <span className={`font-bold ${stats.predicted === stats.total && stats.total > 0 ? "text-[#06A77D]" : "text-white/70"}`}>
                  {stats.predicted}
                </span>
                /{stats.total}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {groupedByDate.length === 0 && (
          <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
            אין משחקים במחזור זה
          </p>
        )}
        {groupedByDate.map(([dateLabel, matches]) => (
          <section key={dateLabel}>
            <p className="eyebrow mb-2 px-1">{dateLabel}</p>
            <div className="flex flex-col gap-2.5">
              {matches.map((m) => (
                <MatchListItem
                  key={m.id}
                  match={m}
                  prediction={byMatchId[m.id] ?? null}
                  hasDDActive={ddActiveByMatch.has(m.id)}
                  onClick={() => handleMatchClick(m)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Match prediction modal */}
      {openMatch && (
        <MatchPredictionModal
          match={openMatch}
          existing={byMatchId[openMatch.id] ?? null}
          ddTokens={tokens}
          onSaved={(p) => {
            setLocalPrediction(p);
          }}
          onDDChanged={() => {
            refreshDD();
          }}
          onClose={() => setOpenMatch(null)}
        />
      )}
    </>
  );
}

// ========================================================
// טאב פלייאוף — 5 תת-טאבים (R32/R16/QF/SF/Final), אותו flow כמו טאב משחקים.
// Final משלב מקומות 3-4 + גמר גדול (2 משחקים).
// ========================================================

type KnockoutStage = "r32" | "r16" | "qf" | "sf" | "final_combined";

const KNOCKOUT_TABS: { key: KnockoutStage; label: string; stages: Stage[] }[] = [
  { key: "r32", label: "סבב 32", stages: ["r32"] },
  { key: "r16", label: "שמינית", stages: ["r16"] },
  { key: "qf", label: "רבע", stages: ["qf"] },
  { key: "sf", label: "חצי", stages: ["sf"] },
  { key: "final_combined", label: "גמר", stages: ["third_place", "final"] },
];

function KnockoutTab() {
  const { data: allMatches, loading, error } = useAllMatches();
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // sub-stage (r32/r16/qf/sf/final_combined) נשמר ב-URL
  const subParam = searchParams.get("sub") as KnockoutStage | null;
  const VALID: KnockoutStage[] = ["r32", "r16", "qf", "sf", "final_combined"];
  const selectedStage: KnockoutStage = subParam && VALID.includes(subParam) ? subParam : "r32";
  function setSelectedStage(s: KnockoutStage) {
    setSearchParams({ tab: "knockout", sub: s }, { replace: false });
  }

  const { byMatchId, setLocalPrediction } = useMyMatchPredictions();
  const { tokens, refresh: refreshDD } = useMyDoubleDownTokens();

  function handleMatchClick(m: Match) {
    if (m.predictions_locked || m.status === "live" || m.status === "finished") {
      navigate(`/match/${m.id}`);
    } else {
      setOpenMatch(m);
    }
  }

  // משחקים בשלב הנבחר
  const matchesInStage = useMemo(() => {
    if (!allMatches) return [];
    const cfg = KNOCKOUT_TABS.find((t) => t.key === selectedStage);
    if (!cfg) return [];
    return allMatches
      .filter((m) => cfg.stages.includes(m.stage))
      .sort((a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime());
  }, [allMatches, selectedStage]);

  // סטטיסטיקות לכל שלב (לתת-טאבים)
  const stageStats = useMemo(() => {
    const stats: Record<KnockoutStage, { total: number; predicted: number }> = {
      r32: { total: 0, predicted: 0 },
      r16: { total: 0, predicted: 0 },
      qf: { total: 0, predicted: 0 },
      sf: { total: 0, predicted: 0 },
      final_combined: { total: 0, predicted: 0 },
    };
    if (!allMatches) return stats;
    for (const m of allMatches) {
      for (const tab of KNOCKOUT_TABS) {
        if (tab.stages.includes(m.stage)) {
          stats[tab.key].total++;
          if (byMatchId[m.id]) stats[tab.key].predicted++;
        }
      }
    }
    return stats;
  }, [allMatches, byMatchId]);

  // קיבוץ לפי יום
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matchesInStage) {
      const date = new Date(m.kickoff_utc);
      const key = date.toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [matchesInStage]);

  // מפה: match_id → האם יש ז'יטון DD פעיל עליו
  const ddActiveByMatch = useMemo(() => {
    const s = new Set<number>();
    for (const t of tokens) {
      if (t.status === "active" && t.match_id) s.add(t.match_id);
    }
    return s;
  }, [tokens]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>;
  }
  if (error) {
    return <p className="py-12 text-center text-sm" style={{ color: "var(--color-error)" }}>{error}</p>;
  }

  return (
    <>
      {/* === Sub-tabs: 5 שלבי פלייאוף === */}
      <div className="mb-4 grid grid-cols-5 gap-1">
        {KNOCKOUT_TABS.map(({ key, label }) => {
          const isActive = selectedStage === key;
          const stats = stageStats[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedStage(key)}
              className="relative rounded-2xl px-1.5 py-2 no-tap transition-all"
              style={{
                background: isActive
                  ? "linear-gradient(135deg, rgba(230,57,70,0.18), rgba(230,57,70,0.08))"
                  : "rgba(20,27,45,0.50)",
                border: `1.5px solid ${isActive ? "rgba(230,57,70,0.50)" : "rgba(255,255,255,0.08)"}`,
                backdropFilter: "blur(12px) saturate(140%)",
                WebkitBackdropFilter: "blur(12px) saturate(140%)",
              }}
            >
              <p className={`text-[11.5px] font-extrabold leading-tight ${isActive ? "text-white" : "text-white/85"}`}>
                {label}
              </p>
              <p className="num mt-0.5 text-[10px] text-[color:var(--color-muted)]">
                <span
                  className={`font-bold ${stats.predicted === stats.total && stats.total > 0 ? "text-[#06A77D]" : "text-white/70"}`}
                >
                  {stats.predicted}
                </span>
                /{stats.total}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {groupedByDate.length === 0 && (
          <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
            אין משחקים בשלב זה
          </p>
        )}
        {groupedByDate.map(([dateLabel, matches]) => (
          <section key={dateLabel}>
            <p className="eyebrow mb-2 px-1">{dateLabel}</p>
            <div className="flex flex-col gap-2.5">
              {matches.map((m) => (
                <MatchListItem
                  key={m.id}
                  match={m}
                  prediction={byMatchId[m.id] ?? null}
                  hasDDActive={ddActiveByMatch.has(m.id)}
                  onClick={() => handleMatchClick(m)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {openMatch && (
        <MatchPredictionModal
          match={openMatch}
          existing={byMatchId[openMatch.id] ?? null}
          ddTokens={tokens}
          onSaved={(p) => {
            setLocalPrediction(p);
          }}
          onDDChanged={() => {
            refreshDD();
          }}
          onClose={() => setOpenMatch(null)}
        />
      )}
    </>
  );
}
