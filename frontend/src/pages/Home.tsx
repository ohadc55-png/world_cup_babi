// המסך הראשי — Hero + רשימת משחקי היום + לוח דירוג + ניווט תחתון
// (BottomNav מסופק על ידי ה-ProtectedLayout)
//
// פאזה 4 chunk 2: עודכן להשתמש בנתונים אמיתיים מה-API במקום mocks.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchesToday, useNextMatch } from "@/hooks/useMatches";
import { useMyGame } from "@/hooks/useGame";
import { useMyScore } from "@/hooks/useLeaderboard";
import { getTeamInfo } from "@/lib/teams";
import type { Match } from "@/types";
import { Logo } from "@/components/layout/Logo";
import { HeroNextMatch } from "@/components/home/HeroNextMatch";
import { MatchCard, type MatchCardProps } from "@/components/home/MatchCard";
import { InviteSheet } from "@/components/game/InviteSheet";
import { PushOptInBanner } from "@/components/home/PushOptInBanner";

// תרגום שלב לעברית
function stageHe(stage: Match["stage"]): string {
  const map: Record<string, string> = {
    group: "שלב הבתים",
    r32: "סבב 32",
    r16: "שמינית גמר",
    qf: "רבע גמר",
    sf: "חצי גמר",
    third_place: "מקומות 3-4",
    final: "גמר",
  };
  return map[stage] ?? stage;
}

// מתאם משחק מה-API לפרופים של MatchCard
function matchToCardProps(match: Match): MatchCardProps {
  const home = getTeamInfo(match.team_home);
  const away = getTeamInfo(match.team_away);

  // שעת תחילה בפורמט HH:MM בזמן מקומי של המשתמש
  const date = new Date(match.kickoff_utc);
  const timeLocal = date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // תווית קבוצה/שלב — בעברית
  const groupLabel =
    match.stage === "group" && match.group_name
      ? `בית ${match.group_name}`
      : stageHe(match.stage);

  // מצב הכרטיס: live / finished (כולל פנדלים) / unpredicted
  if (match.status === "live") {
    return {
      timeLocal,
      groupLabel,
      teamHome: { flag: home.flag, nameHe: home.he },
      teamAway: { flag: away.flag, nameHe: away.he },
      state: {
        kind: "live",
        scoreHome: match.score_home ?? 0,
        scoreAway: match.score_away ?? 0,
        minute: "—'", // יעודכן כשנחבר ל-display_clock של ESPN
      },
    };
  }

  if (match.status === "finished") {
    return {
      timeLocal,
      groupLabel,
      teamHome: { flag: home.flag, nameHe: home.he },
      teamAway: { flag: away.flag, nameHe: away.he },
      state: {
        kind: "finished",
        scoreHome: match.score_home ?? 0,
        scoreAway: match.score_away ?? 0,
        pensHome: match.score_home_pen,
        pensAway: match.score_away_pen,
      },
    };
  }

  // ברירת מחדל: unpredicted (לפני שנחבר לטבלת ניחושים — chunk 3+)
  return {
    timeLocal,
    groupLabel,
    teamHome: { flag: home.flag, nameHe: home.he },
    teamAway: { flag: away.flag, nameHe: away.he },
    state: { kind: "unpredicted" },
  };
}

export function Home() {
  const { user } = useAuth();
  const { data: nextMatch, loading: nextLoading } = useNextMatch();
  const { data: todayMatches, loading: todayLoading } = useMatchesToday();
  const { data: myGame } = useMyGame();
  const { data: myScore } = useMyScore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const navigate = useNavigate();

  // countdown ל-kickoff של המשחק הבא, מתעדכן כל שניה
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!nextMatch) return;
    function tick() {
      const ms = new Date(nextMatch!.kickoff_utc).getTime() - Date.now();
      setCountdown(Math.max(0, Math.floor(ms / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextMatch]);

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  // מיפוי משחקי היום ל-MatchCard props (memoized כדי לא לחשב כל render)
  const todayCardProps = useMemo(() => {
    return (todayMatches ?? []).map(matchToCardProps);
  }, [todayMatches]);

  return (
    <div className="min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      {/* ================ STICKY HEADER ================ */}
      <header
        className="sticky top-0 z-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.78), rgba(10,14,26,0.30) 70%, transparent)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          // iOS Notch: max(14px, safe-area) כדי שהכותרת לא תיחתך מתחת לחיתוך
          paddingTop: "max(14px, env(safe-area-inset-top))",
        }}
      >
        <div className="flex h-11 items-center justify-between px-5">
          <div className="flex items-center gap-1 -ms-2">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 no-tap">
              <Bell size={17} strokeWidth={1.6} color="#F4F6FB" />
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: "#E63946" }}
              />
            </button>
            {/* כפתור הזמנת חברים — נסתר אחרי תחילת הטורניר (אי אפשר להוסיף חברים יותר) */}
            {myGame && !myGame.tournament_has_started && (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 no-tap"
                aria-label="הזמן חברים"
                title="הזמן חברים"
              >
                <UserPlus size={17} strokeWidth={1.6} color="#FFD93D" />
              </button>
            )}
          </div>
          <Logo size={24} showWordmark showTagline />
        </div>
      </header>

      {/* ================ PUSH OPT-IN BANNER ================ */}
      <section className="px-5 pt-3">
        <PushOptInBanner />
      </section>

      {/* ================ ALONE BANNER ================ */}
      {/* מוצג רק אם: לבד במשחק + הטורניר עוד לא התחיל */}
      {myGame && myGame.member_count === 1 && !myGame.tournament_has_started && (
        <section className="px-5 pt-3">
          <button
            onClick={() => setInviteOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-end transition-all hover:scale-[1.005]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,217,61,0.10) 0%, rgba(255,170,0,0.05) 100%)",
              border: "1.5px solid rgba(255,217,61,0.32)",
              boxShadow: "0 8px 24px -8px rgba(255,170,0,0.18)",
            }}
          >
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: "rgba(255,217,61,0.15)",
                border: "1px solid rgba(255,217,61,0.40)",
              }}
            >
              <Sparkles size={18} color="#FFD93D" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-white">המשחק חדש — הזמן את החברים!</p>
              <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
                שתף את הקוד <span className="num font-bold text-[#FFD93D]">{myGame.invite_code}</span>{" "}
                בקבוצת WhatsApp
              </p>
            </div>
          </button>
        </section>
      )}

      {/* ================ STATUS ROW ================ */}
      <section className="px-5 pt-3 pb-3">
        <div className="flex items-center justify-end gap-2.5">
          <span className="num text-[11px] font-medium text-[color:var(--color-muted)]">
            {myScore?.rank != null ? (
              <>
                מקום <span className="text-white font-bold num-tight">{myScore.rank}</span>
                <span className="text-[#3F465A]">/</span>
                <span className="text-white/70 num-tight">{myScore.total_users}</span>
                <span className="mx-0.5 text-[#3F465A]">·</span>
              </>
            ) : null}
            <span
              className="num-tight font-extrabold"
              style={{ color: "#FFD93D", textShadow: "0 0 18px rgba(255,217,61,0.25)" }}
            >
              {myScore?.total_points ?? 0}
            </span>{" "}
            <span className="text-[color:var(--color-muted)]">נק׳</span>
          </span>
          <div className="h-3.5 w-px bg-white/15" />
          <span className="text-[12px] font-semibold text-white">{user?.username ?? "אורח"}</span>
          <div
            className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg, #E63946, #1D3557)",
              boxShadow: "0 4px 12px -4px rgba(230,57,70,0.5), inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          >
            {initial}
          </div>
        </div>
      </section>

      {/* ================ HERO ================ */}
      {nextLoading && (
        <section
          className="mx-5 flex items-center justify-center rounded-2xl"
          style={{ height: 500, background: "rgba(20,27,45,0.45)" }}
        >
          <span className="text-[color:var(--color-muted)] text-sm">טוען את המשחק הבא...</span>
        </section>
      )}
      {!nextLoading && !nextMatch && (
        <section
          className="mx-5 flex items-center justify-center rounded-2xl text-center"
          style={{ height: 240, background: "rgba(20,27,45,0.45)" }}
        >
          <div>
            <p className="text-white font-bold text-lg">המונדיאל נגמר 🏆</p>
            <p className="mt-1 text-[color:var(--color-muted)] text-sm">בדוק את הדירוג הסופי</p>
          </div>
        </section>
      )}
      {nextMatch && (
        <HeroNextMatch
          teamHome={{
            flag: getTeamInfo(nextMatch.team_home).flag,
            nameHe: getTeamInfo(nextMatch.team_home).he,
          }}
          teamAway={{
            flag: getTeamInfo(nextMatch.team_away).flag,
            nameHe: getTeamInfo(nextMatch.team_away).he,
          }}
          countdownSeconds={countdown}
          venue={nextMatch.venue ?? "—"}
          city=""
          kickoffLocal={new Date(nextMatch.kickoff_utc).toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
          matchLabel={
            nextMatch.stage === "group" && nextMatch.group_name
              ? `בית ${nextMatch.group_name} · משחק ${nextMatch.match_number ?? nextMatch.id}`
              : `${stageHe(nextMatch.stage)} · משחק ${nextMatch.id}`
          }
          onPredictClick={() => navigate("/predictions")}
        />
      )}

      {/* ================ BELOW HERO ================ */}
      <main className="px-5">
        {/* Gold hairline divider */}
        <div
          className="mx-auto"
          style={{
            width: 60,
            height: 1,
            margin: "28px auto",
            background:
              "linear-gradient(90deg, transparent, rgba(255,217,61,0.30) 30%, rgba(255,217,61,0.30) 70%, transparent)",
          }}
        />

        {/* TODAY'S MATCHES */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="eyebrow">המשחקים של היום</span>
            <span className="text-[10.5px] font-medium text-[color:var(--color-muted)]">
              <span className="num font-bold text-white">{todayCardProps.length}</span> משחקים
            </span>
          </div>
          {todayLoading && (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>
          )}
          {!todayLoading && todayCardProps.length === 0 && (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">
              אין משחקים היום
            </p>
          )}
          {!todayLoading && todayCardProps.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {todayCardProps.map((m, i) => {
                const original = (todayMatches ?? [])[i];
                // לחיצה: רק אם המשחק נעול/חי/סיים -> ניווט לדף פרטי המשחק.
                const clickable =
                  original &&
                  (original.predictions_locked ||
                    original.status === "live" ||
                    original.status === "finished");
                return (
                  <MatchCard
                    key={i}
                    {...m}
                    onClick={
                      clickable ? () => navigate(`/match/${original.id}`) : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Leaderboard top reveal */}
        <section className="mt-7">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="eyebrow">לוח הצמרת</span>
            <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-muted)] hover:text-white">
              <span>דירוג מלא</span>
              <ChevronLeft size={10} strokeWidth={2.4} />
            </button>
          </div>

          <div
            className="flex items-center gap-3 px-4 py-3.5"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,217,61,0.06), rgba(255,217,61,0) 70%)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
            }}
          >
            <div
              className="num grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold"
              style={{
                background: "linear-gradient(135deg,#FFD93D,#E0B617)",
                color: "#1A1300",
                boxShadow: "0 6px 18px -6px rgba(255,217,61,0.5)",
              }}
            >
              1
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold leading-tight text-white">דניאל כהן</p>
            </div>
            <div className="text-end">
              <span
                className="num text-[18px] font-extrabold num-tight"
                style={{ color: "#FFD93D", textShadow: "0 0 18px rgba(255,217,61,0.25)" }}
              >
                312
              </span>
              <span className="ms-1 text-[10px] font-medium text-[color:var(--color-muted)]">נק׳</span>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom-sheet להזמנת חברים */}
      <InviteSheet game={inviteOpen ? myGame : null} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
