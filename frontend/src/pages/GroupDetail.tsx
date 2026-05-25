// עמוד פירוט בית — נגיש מ-`/group/:name` (לחיצה על כרטיס בית בעמוד טורניר).
//
// תצוגה:
//   1. כותרת + back button
//   2. טבלת הבית המלאה (live), עם דגלים בעברית
//   3. רשימת 6 משחקי הבית, מקובצים לפי מחזור (1/2/3)
//      - משחקים שעברו: מציגים תוצאה
//      - משחקים עתידיים: מציגים שעת kickoff
//      - לחיצה על משחק → /match/:id (המשחק המלא + ניחושי החברים)

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { useAllMatches } from "@/hooks/useMatches";
import { useMyMatchPredictions, useMyDoubleDownTokens } from "@/hooks/usePredictions";
import { useGroupStandings } from "@/hooks/useGroupStandings";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import { GroupStandingsStatic } from "@/components/groups/GroupStandingsTable";
import { MatchListItem } from "@/components/predictions/MatchListItem";
import type { Match } from "@/types";

export function GroupDetail() {
  const { name } = useParams<{ name: string }>();
  const groupName = (name ?? "").toUpperCase();
  const navigate = useNavigate();

  const { data: allMatches, loading: matchesLoading } = useAllMatches();
  const { data: standings, loading: standingsLoading, error: standingsError } = useGroupStandings();
  const { byMatchId } = useMyMatchPredictions();
  const { tokens } = useMyDoubleDownTokens();

  // הטבלה של הבית הספציפי
  const groupStanding = useMemo(
    () => standings?.find((g) => g.group_name === groupName) ?? null,
    [standings, groupName],
  );

  // משחקי הבית, מקובצים לפי מחזור (1/2/3)
  const matchesByRound = useMemo(() => {
    const all = (allMatches ?? []).filter(
      (m) => m.stage === "group" && m.group_name === groupName,
    );
    const map = new Map<number, Match[]>();
    for (const m of all) {
      const round = m.group_round ?? 0;
      const arr = map.get(round) ?? [];
      arr.push(m);
      map.set(round, arr);
    }
    // מיון בתוך כל מחזור לפי kickoff
    map.forEach((list) =>
      list.sort(
        (a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
      ),
    );
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [allMatches, groupName]);

  // DD active per match
  const ddActiveByMatch = useMemo(() => {
    const s = new Set<number>();
    for (const t of tokens) {
      if (t.status === "active" && t.match_id) s.add(t.match_id);
    }
    return s;
  }, [tokens]);

  function handleMatchClick(m: Match) {
    // תמיד פותחים את עמוד המשחק (משחק עתידי, חי, או הסתיים — אותו דף)
    navigate(`/match/${m.id}`);
  }

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc4.webp" intensity="balanced" />
      <div className="relative z-10">
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
          {/* === Standings === */}
          {standingsLoading && (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">טוען טבלה...</p>
          )}
          {!standingsLoading && standingsError && (
            <div
              className="rounded-2xl p-4 text-center"
              style={{
                background: "rgba(230,57,70,0.08)",
                border: "1.5px solid rgba(230,57,70,0.28)",
              }}
            >
              <p className="text-[13px] font-bold text-white mb-1">לא ניתן לטעון את הטבלה</p>
              <p className="text-[11px] text-[color:var(--color-muted)]">{standingsError}</p>
            </div>
          )}
          {!standingsLoading && !standingsError && !groupStanding && (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">
              בית {groupName} לא נמצא
            </p>
          )}
          {groupStanding && <GroupStandingsStatic standing={groupStanding} />}

          {/* === Matches by round === */}
          {!matchesLoading && matchesByRound.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <Calendar size={14} color="#9BBAEA" />
                <span className="eyebrow">משחקי הבית</span>
              </div>
              <div className="flex flex-col gap-4">
                {matchesByRound.map(([round, matches]) => (
                  <div key={round}>
                    <p className="mb-2 px-1 text-[11px] font-bold text-[color:var(--color-muted)]">
                      מחזור <span className="num text-white">{round}</span>
                    </p>
                    <div className="flex flex-col gap-2">
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
                  </div>
                ))}
              </div>
            </section>
          )}

          {!matchesLoading && matchesByRound.length === 0 && groupStanding && (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">
              אין משחקים בבית זה
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
