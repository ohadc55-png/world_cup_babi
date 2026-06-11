// עמוד הדירוג — לוח התוצאות החי של הקבוצה (Table layout).
//
// מבנה:
// - Header sticky עם לוגו וסיכום אישי קטן
// - MyScoreCard — סיכום אישי בולט בראש (פער מהמוביל, מהבא וכו')
// - LeaderboardTable — כל המשתמשים בשורות מובנות:
//     [#rank] [trophy אם top3] [avatar] [שם] [נק'] [bar אחוז דיוק]
//   3 ראשונים עם רקעי זהב/כסף/ארד. השורה של המשתמש הנוכחי מודגשת.
//
// אחוז הדיוק מחושב: correct_count / total_predictions * 100
// צבע ה-bar נע מאדום (0%) -> צהוב (50%) -> ירוק (100%) דרך HSL.
//
// במצב mock (`?mock=1`): נתונים פיקטיביים במקום ה-API.

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, useMyScore } from "@/hooks/useLeaderboard";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import { MOCK_LEADERBOARD, MOCK_MY_SCORE } from "@/lib/mockLeaderboard";
import type { LeaderboardEntry } from "@/types";

export function Leaderboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMock = searchParams.get("mock") === "1";

  const { data: liveLb, loading: lbLoading, error: lbError } = useLeaderboard();
  const { data: liveMe, loading: meLoading } = useMyScore();

  const leaderboard = isMock ? MOCK_LEADERBOARD : liveLb;
  const myScore = isMock ? MOCK_MY_SCORE : liveMe;
  const loading = isMock ? false : lbLoading || meLoading;

  const myEntryIndex = useMemo(() => {
    if (!leaderboard) return -1;
    return leaderboard.findIndex((e) =>
      isMock ? e.username === (user?.username ?? "") : e.user_id === user?.id,
    );
  }, [leaderboard, user?.id, user?.username, isMock]);

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc6.jpg" intensity="vivid" />
      <div className="relative z-10">
        {/* ================ STICKY HEADER ================ */}
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
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold"
                style={{ color: "#FFD93D", letterSpacing: "0.08em" }}
              >
                דירוג חי
              </span>
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#FFD93D]" />
            </div>
            <Logo size={24} showWordmark showTagline />
          </div>
        </header>

        <main className="px-4 pt-3">
          {isMock && (
            <div
              className="mb-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,217,61,0.12), rgba(255,170,0,0.04))",
                border: "1px solid rgba(255,217,61,0.40)",
              }}
            >
              <div>
                <p
                  className="text-[11px] font-extrabold uppercase"
                  style={{ color: "#FFD93D", letterSpacing: "0.14em" }}
                >
                  Mock Mode
                </p>
                <p className="mt-0.5 text-[10px] text-white/55">
                  תצוגת עיצוב — לא נתונים אמיתיים
                </p>
              </div>
              <button
                onClick={() => {
                  searchParams.delete("mock");
                  setSearchParams(searchParams, { replace: true });
                }}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white no-tap"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
              >
                חזור לנתונים אמיתיים
              </button>
            </div>
          )}

          {loading && (
            <div className="py-20 text-center">
              <p className="text-sm text-[color:var(--color-muted)]">טוען דירוג...</p>
            </div>
          )}

          {!loading && lbError && (
            <div className="py-20 text-center">
              <p className="text-sm" style={{ color: "var(--color-error)" }}>
                {lbError}
              </p>
            </div>
          )}

          {!loading && !lbError && leaderboard && leaderboard.length === 0 && <EmptyState />}

          {!loading && !lbError && leaderboard && leaderboard.length > 0 && (
            <>
              {/* === MY SCORE summary === */}
              {myScore && myScore.rank !== null && (
                <MyScoreCard
                  rank={myScore.rank}
                  totalUsers={myScore.total_users}
                  totalPoints={myScore.total_points}
                  pointsToNext={myScore.points_to_next}
                  pointsAboveBelow={myScore.points_above_below}
                  username={user?.username ?? "אורח"}
                />
              )}

              {/* === Table === */}
              <section className="mt-5">
                <SectionHeader title="הדירוג" count={leaderboard.length} />
                <LeaderboardTable
                  entries={leaderboard}
                  myUserId={isMock ? null : user?.id ?? null}
                  myUsername={isMock ? user?.username ?? "" : null}
                />
              </section>

              {myEntryIndex >= 0 && myEntryIndex < 3 && (
                <p
                  className="mt-6 text-center text-[11px] uppercase text-white/45"
                  style={{ letterSpacing: "0.20em" }}
                >
                  כל הכבוד · אתה בטופ 3
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// SectionHeader — כותרת עם hairline זהוב
// ============================================================

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 px-1">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-[12px] font-extrabold uppercase"
          style={{ color: "#FFD93D", letterSpacing: "0.24em" }}
        >
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[10px] font-medium text-white/45">
            <span className="num font-bold text-white">{count}</span> משתתפים
          </span>
        )}
      </div>
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
// MyScoreCard — סיכום אישי קטן ומוקפד
// ============================================================

function MyScoreCard({
  rank,
  totalUsers,
  totalPoints,
  pointsToNext,
  pointsAboveBelow,
  username,
}: {
  rank: number;
  totalUsers: number;
  totalPoints: number;
  pointsToNext: number | null;
  pointsAboveBelow: number | null;
  username: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(230,57,70,0.12) 0%, rgba(29,53,87,0.20) 100%)",
        border: "1px solid rgba(230,57,70,0.32)",
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div
          className="num grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[18px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg, #E63946, #1D3557)",
            boxShadow:
              "0 6px 18px -6px rgba(230,57,70,0.45), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          {rank}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase"
            style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em" }}
          >
            המקום שלי
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-white">{username}</p>
          <p className="num text-[10px] text-white/45">
            מתוך <span className="font-bold text-white">{totalUsers}</span> משתתפים
          </p>
        </div>

        <div className="text-end" style={{ direction: "ltr" }}>
          <span
            className="num font-extrabold leading-none num-tight"
            style={{
              fontSize: 30,
              color: "#FFD93D",
              textShadow: "0 0 18px rgba(255,217,61,0.30)",
              letterSpacing: "-0.03em",
            }}
          >
            {totalPoints}
          </span>
          <span className="ms-1 text-[10px] font-medium text-white/55">נק׳</span>
        </div>
      </div>

      {(pointsToNext !== null || pointsAboveBelow !== null) && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2 text-[10.5px] text-white/55"
          style={{
            background: "rgba(0,0,0,0.22)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span>
            {pointsToNext === null ? (
              <span className="font-bold text-[#FFD93D]">המוביל ✨</span>
            ) : pointsToNext === 0 ? (
              <>תיקו עם המוביל</>
            ) : (
              <>
                פער ל-#{rank - 1}: <span className="num font-bold text-white">{pointsToNext}</span>{" "}
                נק׳
              </>
            )}
          </span>
          {pointsAboveBelow !== null && pointsAboveBelow > 0 && (
            <span>
              <span className="num font-bold text-white">{pointsAboveBelow}</span> מעל הבא
            </span>
          )}
        </div>
      )}
    </motion.section>
  );
}

// ============================================================
// LeaderboardTable — טבלה מובנית, רוחב מלא
// ============================================================

function LeaderboardTable({
  entries,
  myUserId,
  myUsername,
}: {
  entries: LeaderboardEntry[];
  myUserId: string | null;
  myUsername: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Column headers (subtle) */}
      <div
        className="grid items-center gap-2 px-3 py-2 text-[9.5px] font-bold uppercase text-white/40"
        style={{
          gridTemplateColumns: "28px 1fr auto 96px",
          letterSpacing: "0.14em",
        }}
      >
        <span className="text-center">מקום</span>
        <span className="text-end">משתתף</span>
        <span className="text-end">נקודות</span>
        <span className="text-end">אחוז דיוק</span>
      </div>

      {entries.map((entry, idx) => {
        const isMe =
          myUserId !== null
            ? entry.user_id === myUserId
            : myUsername !== null && entry.username === myUsername;
        return <LeaderboardRow key={entry.user_id} entry={entry} isMe={isMe} index={idx} />;
      })}
    </div>
  );
}

// ============================================================
// LeaderboardRow — שורה אחת בטבלה
// ============================================================

function LeaderboardRow({
  entry,
  isMe,
  index,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  index: number;
}) {
  const navigate = useNavigate();
  const isPodium = entry.rank <= 3;
  const podiumStyle = getPodiumStyle(entry.rank);

  // Accuracy %: handle empty case
  const accuracyPct =
    entry.total_predictions > 0
      ? Math.round((entry.correct_count / entry.total_predictions) * 100)
      : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3 }}
      onClick={() => navigate(`/user/${entry.user_id}`)}
      className="grid items-center gap-2 rounded-2xl px-3 py-3 text-end no-tap transition-transform active:scale-[0.99]"
      type="button"
      style={{
        gridTemplateColumns: "28px 1fr auto 96px",
        background: isMe
          ? "linear-gradient(90deg, rgba(123,179,242,0.18), rgba(123,179,242,0.04) 70%)"
          : podiumStyle?.bg ?? "rgba(20,27,45,0.42)",
        border: `1.5px solid ${
          isMe ? "rgba(123,179,242,0.65)" : podiumStyle?.border ?? "rgba(255,255,255,0.06)"
        }`,
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        boxShadow: isMe
          ? "0 8px 22px -10px rgba(123,179,242,0.40)"
          : isPodium
            ? `0 6px 18px -10px ${podiumStyle?.glow}`
            : undefined,
      }}
    >
      {/* Col 1: rank + trophy */}
      <div className="flex flex-col items-center">
        <span
          className="num leading-none"
          style={{
            fontSize: isPodium ? 18 : 16,
            fontWeight: 800,
            color: podiumStyle?.text ?? (isMe ? "#7BB3F2" : "rgba(255,255,255,0.50)"),
            letterSpacing: "-0.03em",
          }}
        >
          {entry.rank}
        </span>
        {isPodium && (
          <TrophyIcon rank={entry.rank as 1 | 2 | 3} />
        )}
      </div>

      {/* Col 2: avatar + name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg, #E63946, #1D3557)",
            boxShadow: "0 3px 10px -3px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.16)",
          }}
        >
          {entry.username[0]?.toUpperCase() ?? "?"}
        </div>
        <p className="min-w-0 truncate text-[13px] font-bold leading-tight text-white">
          {entry.username}
          {isMe && (
            <span className="ms-1.5 text-[10px] font-extrabold" style={{ color: "#7BB3F2" }}>
              (אתה)
            </span>
          )}
        </p>
      </div>

      {/* Col 3: points */}
      <div className="text-end" style={{ direction: "ltr" }}>
        <span
          className="num font-extrabold leading-none num-tight"
          style={{
            fontSize: 18,
            color: isPodium ? podiumStyle?.text : isMe ? "#7BB3F2" : "#F4F6FB",
            letterSpacing: "-0.03em",
          }}
        >
          {entry.total_points}
        </span>
        <span className="ms-0.5 text-[9.5px] font-medium text-white/45">נק׳</span>
      </div>

      {/* Col 4: accuracy bar */}
      <AccuracyBar percentage={accuracyPct} />
    </motion.button>
  );
}

// ============================================================
// AccuracyBar — בר אופקי + אחוז, צבע HSL לפי האחוז
// ============================================================

function AccuracyBar({ percentage }: { percentage: number | null }) {
  if (percentage === null) {
    return (
      <div className="text-center text-[10px] text-white/30 num">—</div>
    );
  }

  // Hue: red(0) → yellow(60) → green(120). Below 30% bias to red.
  const hue = Math.min(120, Math.max(0, percentage * 1.25));
  const fillColor = `hsl(${hue}, 65%, 48%)`;
  const fillGlow = `hsla(${hue}, 75%, 55%, 0.45)`;

  return (
    <div className="flex items-center gap-2 justify-end" style={{ direction: "ltr" }}>
      {/* Bar */}
      <div
        className="relative h-1.5 w-14 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.10)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          className="absolute inset-y-0 right-0 rounded-full"
          style={{
            background: fillColor,
            boxShadow: `0 0 8px ${fillGlow}`,
          }}
        />
      </div>
      {/* % label */}
      <span
        className="num text-[12px] font-extrabold num-tight"
        style={{
          color: fillColor,
          minWidth: 32,
          textAlign: "end",
          letterSpacing: "-0.02em",
        }}
      >
        {percentage}%
      </span>
    </div>
  );
}

// ============================================================
// TrophyIcon — אייקון גביע קטן לטופ 3
// ============================================================

function TrophyIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const color = rank === 1 ? "#FFD93D" : rank === 2 ? "#C8D0DD" : "#CD8755";
  return (
    <Trophy
      size={11}
      color={color}
      fill={color}
      style={{ marginTop: 2 }}
    />
  );
}

// ============================================================
// Podium styling helpers
// ============================================================

function getPodiumStyle(rank: number) {
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
  if (rank === 3) {
    return {
      bg: "linear-gradient(90deg, rgba(205,135,85,0.18), rgba(205,135,85,0.05) 70%)",
      border: "rgba(205,135,85,0.48)",
      text: "#E8B58A",
      glow: "rgba(205,135,85,0.26)",
    };
  }
  return null;
}

// ============================================================
// EmptyState — אין משתתפים / אין ניקוד עדיין
// ============================================================

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 px-6 text-center">
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{
          background: "rgba(255,217,61,0.10)",
          border: "1px solid rgba(255,217,61,0.20)",
        }}
      >
        <Medal size={28} color="#FFD93D" />
      </div>
      <p className="text-[15px] font-bold text-white">הדירוג עוד לא התחיל</p>
      <p className="text-[12px] text-[color:var(--color-muted)]">
        ברגע שהמשחק הראשון יסתיים, ה-Leaderboard יקבע אלוף.
      </p>
    </div>
  );
}
