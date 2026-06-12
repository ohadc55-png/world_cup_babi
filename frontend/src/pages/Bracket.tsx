// עמוד הטורניר — תצוגת המידע הרלוונטי בהתאם לשלב.
//
// 2 תת-טאבים:
//   - "בתים": 12 טבלאות הבתים החיות (נבחר אוטומטית בזמן שלב הבתים)
//   - "פלייאוף": תרשים הנוקאאוט המלא (R32 → R16 → QF → SF → Final + 3rd)
//
// במובייל: גלילה אופקית בפלייאוף, רשימה אנכית בטבלאות.

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useAllMatches } from "@/hooks/useMatches";
import { useGroupStandings } from "@/hooks/useGroupStandings";
import { getTeamInfo } from "@/lib/teams";
import { formatScore } from "@/lib/matchScore";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import { GroupStandingsCard } from "@/components/groups/GroupStandingsTable";
import { TopAthletesTable } from "@/components/tournament/TopAthletesTable";
import type { Match, Stage } from "@/types";

const COLUMNS: { stage: Stage; title: string; count: number }[] = [
  { stage: "r32", title: "סבב 32", count: 16 },
  { stage: "r16", title: "שמינית", count: 8 },
  { stage: "qf", title: "רבע", count: 4 },
  { stage: "sf", title: "חצי", count: 2 },
  { stage: "final", title: "גמר", count: 1 },
];

type TournamentTab = "groups" | "bracket" | "top";
const VALID_TT: TournamentTab[] = ["groups", "bracket", "top"];

type TopKind = "scorers" | "assisters";
const VALID_TOP: TopKind[] = ["scorers", "assisters"];

export function Bracket() {
  const { data: allMatches, loading: matchesLoading } = useAllMatches();
  const { data: standings, loading: standingsLoading, error: standingsError } = useGroupStandings();

  // ברירת מחדל: אם משחק נוקאאוט כלשהו התחיל → טאב פלייאוף; אחרת → טאב בתים
  const knockoutStarted = useMemo(() => {
    return (allMatches ?? []).some(
      (m) => m.stage !== "group" && (m.status === "live" || m.status === "finished"),
    );
  }, [allMatches]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as TournamentTab | null;
  const activeTab: TournamentTab = tabParam && VALID_TT.includes(tabParam)
    ? tabParam
    : (knockoutStarted ? "bracket" : "groups");
  function setActiveTab(t: TournamentTab) {
    // שומרים גם kind כשעוברים ל-top כדי שהטוגל יזכור היכן היינו
    const next: Record<string, string> = { tab: t };
    if (t === "top") next.kind = (searchParams.get("kind") as TopKind) || "scorers";
    setSearchParams(next, { replace: false });
  }

  const kindParam = searchParams.get("kind") as TopKind | null;
  const activeTopKind: TopKind = kindParam && VALID_TOP.includes(kindParam) ? kindParam : "scorers";
  function setTopKind(k: TopKind) {
    setSearchParams({ tab: "top", kind: k }, { replace: false });
  }

  // קבץ משחקים לפי שלב (לטאב פלייאוף)
  const byStage = useMemo(() => {
    const m = new Map<Stage, Match[]>();
    (allMatches ?? []).forEach((match) => {
      if (match.stage === "group") return;
      const list = m.get(match.stage) ?? [];
      list.push(match);
      m.set(match.stage, list);
    });
    m.forEach((list) =>
      list.sort((a, b) =>
        new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
      ),
    );
    return m;
  }, [allMatches]);

  const thirdPlace = byStage.get("third_place")?.[0];
  const final = byStage.get("final")?.[0];

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc4.webp" intensity="balanced" />
      <div className="relative z-10">
      {/* === Header === */}
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
          <div className="flex items-center gap-1.5">
            <Trophy size={14} color="#FFD93D" />
            <span className="eyebrow">טורניר</span>
          </div>
          <Logo size={24} showWordmark showTagline />
        </div>

        {/* Sub-tabs */}
        <div className="px-5 pb-2 pt-1">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { key: "groups", label: "בתים" },
              { key: "bracket", label: "פלייאוף" },
              { key: "top", label: "מצטיינים" },
            ] as { key: TournamentTab; label: string }[]).map(({ key, label }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="relative rounded-2xl px-3 py-2 no-tap transition-all"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, rgba(230,57,70,0.20), rgba(230,57,70,0.08))"
                      : "rgba(20,27,45,0.45)",
                    border: `1.5px solid ${isActive ? "rgba(230,57,70,0.55)" : "rgba(255,255,255,0.10)"}`,
                    backdropFilter: "blur(12px) saturate(140%)",
                    WebkitBackdropFilter: "blur(12px) saturate(140%)",
                  }}
                >
                  <span className={`text-[12.5px] font-extrabold ${isActive ? "text-white" : "text-white/85"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* === GROUPS TAB === */}
      {activeTab === "groups" && (
        <div className="px-5 pt-3">
          {standingsLoading && (
            <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">טוען טבלאות...</p>
          )}
          {!standingsLoading && standingsError && (
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: "rgba(230,57,70,0.08)",
                border: "1.5px solid rgba(230,57,70,0.28)",
              }}
            >
              <p className="text-[13px] font-bold text-white mb-2">לא ניתן לטעון את הטבלאות</p>
              <p className="text-[11px] text-[color:var(--color-muted)]">{standingsError}</p>
              <p className="mt-3 text-[10.5px] text-[color:var(--color-muted)]">
                ייתכן שצריך להפעיל מחדש את ה-backend.
              </p>
            </div>
          )}
          {!standingsLoading && !standingsError && standings && standings.length === 0 && (
            <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">אין נתונים</p>
          )}
          {!standingsLoading && standings && standings.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {standings.map((g) => (
                <GroupStandingsCard key={g.group_name} standing={g} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === BRACKET TAB === */}
      {activeTab === "bracket" && (
        <>
          {matchesLoading && (
            <p className="py-20 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>
          )}

          {!matchesLoading && allMatches && (
            <>
              {/* גמר + מקומות 3-4 — מוצגים בראש אם הקבוצות ידועות (כלומר אחרי שחצי הגמר הוכרע) */}
              {(finalResolved(final) || finalResolved(thirdPlace)) && (
                <div className="px-5 pt-3 flex flex-col gap-3">
                  {final && (
                    <FinalCard match={final} isFinal />
                  )}
                  {thirdPlace && (
                    <FinalCard match={thirdPlace} isFinal={false} />
                  )}
                </div>
              )}

              {/* 4 עמודות עיקריות (R32→SF) — גלילה אופקית */}
              <div
                className="px-5 pt-3 pb-4"
                style={{ overflowX: "auto", scrollSnapType: "x mandatory" }}
              >
                <div className="flex gap-3" style={{ minWidth: "min-content" }}>
                  {COLUMNS.filter((c) => c.stage !== "final").map((col) => (
                    <Column
                      key={col.stage}
                      title={col.title}
                      matches={byStage.get(col.stage) ?? []}
                      expectedCount={col.count}
                    />
                  ))}
                </div>
              </div>

              {/* גמר + מקומות 3-4 בתחתית — רק אם הקבוצות עדיין לא ידועות */}
              {!finalResolved(final) && !finalResolved(thirdPlace) && (
                <div className="px-5 pt-2 flex flex-col gap-3">
                  {final && (
                    <FinalCard match={final} isFinal />
                  )}
                  {thirdPlace && (
                    <FinalCard match={thirdPlace} isFinal={false} />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* === TOP TAB (מצטיינים) === */}
      {activeTab === "top" && (
        <div className="px-5 pt-3 pb-4">
          {/* Toggle בין מלך שערים למלך בישולים */}
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {([
              { key: "scorers", label: "מלך שערים" },
              { key: "assisters", label: "מלך בישולים" },
            ] as { key: TopKind; label: string }[]).map(({ key, label }) => {
              const isActive = activeTopKind === key;
              return (
                <button
                  key={key}
                  onClick={() => setTopKind(key)}
                  className="rounded-full px-3 py-2 no-tap transition-all"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, rgba(255,217,61,0.18), rgba(255,170,0,0.06))"
                      : "rgba(20,27,45,0.45)",
                    border: `1.5px solid ${isActive ? "rgba(255,217,61,0.55)" : "rgba(255,255,255,0.10)"}`,
                  }}
                >
                  <span
                    className={`text-[12px] font-extrabold ${isActive ? "text-white" : "text-white/85"}`}
                    style={isActive ? { color: "#FFD93D" } : undefined}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <TopAthletesTable category={activeTopKind} />
        </div>
      )}
      </div>
    </div>
  );
}

// ============================================================
// Column — עמודה של שלב אחד (R32/R16/QF/SF)
// ============================================================
function Column({
  title,
  matches,
  expectedCount,
}: {
  title: string;
  matches: Match[];
  expectedCount: number;
}) {
  return (
    <div
      className="shrink-0"
      style={{ width: 160, scrollSnapAlign: "start" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-extrabold text-white">{title}</span>
        <span className="num text-[9.5px] text-[color:var(--color-muted)]">
          {matches.length}/{expectedCount}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {matches.map((match) => (
          <BracketMatch
            key={match.id}
            match={match}
          />
        ))}
        {/* placeholder אם חסרים משחקים */}
        {Array.from({ length: Math.max(0, expectedCount - matches.length) }).map((_, i) => (
          <PlaceholderMatch key={`ph-${i}`} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// BracketMatch — כרטיס משחק קטן
// ============================================================
function BracketMatch({ match }: { match: Match }) {
  const navigate = useNavigate();
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);
  const isFinished = match.status === "finished";
  const isPlaceholder = !match.team_home || /\d|[/]/.test(match.team_home) && match.team_home.length < 8;
  const clickable = !isPlaceholder && (match.predictions_locked || match.status === "live" || isFinished);

  const score = isFinished
    ? formatScore(match.score_home, match.score_away, match.score_home_pen, match.score_away_pen)
    : null;

  return (
    <div
      onClick={clickable ? () => navigate(`/match/${match.id}`) : undefined}
      className={`relative rounded-lg p-2 ${clickable ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""}`}
      style={{
        background: "rgba(20,27,45,0.55)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <TeamRow
        flag={home.flag}
        name={isPlaceholder ? match.team_home : home.he}
        score={score?.home}
        isPlaceholder={isPlaceholder}
      />
      <div className="my-1 h-px bg-white/5" />
      <TeamRow
        flag={away.flag}
        name={isPlaceholder ? match.team_away : away.he}
        score={score?.away}
        isPlaceholder={isPlaceholder}
      />
    </div>
  );
}

function TeamRow({
  flag, name, score, isPlaceholder,
}: { flag: string; name: string; score?: string; isPlaceholder: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{isPlaceholder ? "🏳️" : flag}</span>
      <span
        className="flex-1 truncate text-[10.5px] font-bold"
        style={{ color: isPlaceholder ? "#8A93A6" : "#F4F6FB" }}
      >
        {name}
      </span>
      {score !== undefined && (
        <span className="num text-[12px] font-extrabold text-white num-tight">{score}</span>
      )}
    </div>
  );
}

function PlaceholderMatch() {
  return (
    <div
      className="rounded-lg p-2"
      style={{
        background: "rgba(20,27,45,0.30)",
        border: "1px dashed rgba(255,255,255,0.08)",
        height: 56,
      }}
    />
  );
}

// ============================================================
// FinalCard — תצוגה מיוחדת לגמר + מקומות 3-4
// ============================================================
function FinalCard({
  match, isFinal,
}: { match: Match; isFinal: boolean }) {
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);
  const isFinished = match.status === "finished";
  const score = isFinished
    ? formatScore(match.score_home, match.score_away, match.score_home_pen, match.score_away_pen)
    : null;
  const isPlaceholder = !match.team_home || /\d|[/]/.test(match.team_home) && match.team_home.length < 8;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4"
      style={{
        background: isFinal
          ? "linear-gradient(135deg, rgba(255,217,61,0.10) 0%, rgba(255,170,0,0.04) 100%)"
          : "linear-gradient(135deg, rgba(155,186,234,0.08) 0%, rgba(29,53,87,0.04) 100%)",
        border: isFinal
          ? "1.5px solid rgba(255,217,61,0.32)"
          : "1px solid rgba(155,186,234,0.20)",
        boxShadow: isFinal
          ? "0 8px 24px -8px rgba(255,170,0,0.20)"
          : undefined,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {isFinal && <Trophy size={14} color="#FFD93D" />}
        <span
          className="text-[11px] font-extrabold uppercase"
          style={{
            color: isFinal ? "#FFD93D" : "#9BBAEA",
            letterSpacing: "0.12em",
          }}
        >
          {isFinal ? "הגמר 🏆" : "מקומות 3-4"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-2xl">{isPlaceholder ? "🏳️" : home.flag}</span>
          <span className="text-[14px] font-bold text-white truncate">
            {isPlaceholder ? match.team_home : home.he}
          </span>
        </div>
        <div className="text-center min-w-[60px]">
          {score ? (
            // RTL: away digit on left, home digit on right — matches team layout
            <span className="num text-[18px] font-extrabold text-white">
              {score.away}–{score.home}
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[color:var(--color-muted)]">VS</span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="text-[14px] font-bold text-white truncate">
            {isPlaceholder ? match.team_away : away.he}
          </span>
          <span className="text-2xl">{isPlaceholder ? "🏳️" : away.flag}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// finalResolved — true אם המשחק קיים והקבוצות שלו אינן placeholders ("W101"/"1A")
// ============================================================
function finalResolved(match: Match | undefined): boolean {
  if (!match) return false;
  // placeholders ידועים: "W101", "L102" (מנצח/מפסיד של משחק), "1A", "3A/B/C/D/F" (מיקום בקבוצה)
  const isPlaceholder = (name: string) => /\d|[/]/.test(name) && name.length < 12;
  return !isPlaceholder(match.team_home) && !isPlaceholder(match.team_away);
}
