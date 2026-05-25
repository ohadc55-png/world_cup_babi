// עמוד הדירוג — לוח התוצאות החי של הקבוצה.
//
// מבנה:
// - Header sticky עם לוגו וסיכום אישי קטן
// - Hero podium: top-3 עם גלורי זהב/כסף/ארד
// - "המקום שלי" — אם המשתמש לא בטופ 3
// - רשימת השאר (מ-#4 והלאה)
//
// כל הנתונים מ-/api/leaderboard ו-/api/leaderboard/me.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Medal, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, useMyScore } from "@/hooks/useLeaderboard";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import type { LeaderboardEntry } from "@/types";

export function Leaderboard() {
  const { user } = useAuth();
  const { data: leaderboard, loading: lbLoading, error: lbError } = useLeaderboard();
  const { data: myScore, loading: meLoading } = useMyScore();

  const loading = lbLoading || meLoading;

  // טופ 3 לפודיום + שאר הרשימה (4+)
  const { top3, rest, myEntryIndex } = useMemo(() => {
    if (!leaderboard) return { top3: [], rest: [], myEntryIndex: -1 };
    const top3 = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);
    const myEntryIndex = leaderboard.findIndex((e) => e.user_id === user?.id);
    return { top3, rest, myEntryIndex };
  }, [leaderboard, user?.id]);

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

      <main className="px-5 pt-3">
        {loading && (
          <div className="py-20 text-center">
            <p className="text-sm text-[color:var(--color-muted)]">טוען דירוג...</p>
          </div>
        )}

        {!loading && lbError && (
          <div className="py-20 text-center">
            <p className="text-sm" style={{ color: "var(--color-error)" }}>{lbError}</p>
          </div>
        )}

        {!loading && !lbError && leaderboard && leaderboard.length === 0 && (
          <EmptyState />
        )}

        {!loading && !lbError && leaderboard && leaderboard.length > 0 && (
          <>
            {/* ================ MY SCORE CARD ================ */}
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

            {/* ================ PODIUM ================ */}
            <section className="mt-6">
              <div className="mb-4 px-1">
                <span className="eyebrow">צמרת הטבלה</span>
              </div>
              <Podium entries={top3} myUserId={user?.id} />
            </section>

            {/* ================ REST OF TABLE ================ */}
            {rest.length > 0 && (
              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="eyebrow">שאר הדירוג</span>
                  <span className="text-[10.5px] font-medium text-[color:var(--color-muted)]">
                    <span className="num font-bold text-white">{rest.length}</span> משתתפים
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {rest.map((e) => (
                    <RankRow
                      key={e.user_id}
                      entry={e}
                      isMe={e.user_id === user?.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* אינדיקציה ויזואלית שאני בטופ 3 */}
            {myEntryIndex >= 0 && myEntryIndex < 3 && (
              <p className="mt-6 text-center text-[11px] text-[color:var(--color-muted)]">
                כל הכבוד! אתה בטופ 3 🏆
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
// MyScoreCard — סיכום אישי בולט בראש העמוד
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
  const trendIcon = pointsToNext === null
    ? <Crown size={14} color="#FFD93D" />
    : pointsToNext <= 0
      ? <Minus size={14} color="#8A93A6" />
      : <TrendingUp size={14} color="#06A77D" />;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(230,57,70,0.10) 0%, rgba(29,53,87,0.18) 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        boxShadow: "0 16px 40px -16px rgba(230,57,70,0.30)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Rank badge */}
        <div
          className="num grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[22px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg, #E63946, #1D3557)",
            boxShadow:
              "0 8px 20px -6px rgba(230,57,70,0.45), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          {rank}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
            המקום שלי
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold text-white">{username}</p>
          <p className="num text-[10.5px] text-[color:var(--color-muted)]">
            מתוך <span className="num-tight font-bold text-white">{totalUsers}</span> משתתפים
          </p>
        </div>

        {/* Points */}
        <div className="text-end">
          <p
            className="num text-[26px] font-extrabold leading-none num-tight"
            style={{ color: "#FFD93D", textShadow: "0 0 18px rgba(255,217,61,0.30)" }}
          >
            {totalPoints}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-[color:var(--color-muted)]">נק׳</p>
        </div>
      </div>

      {/* Delta row */}
      {(pointsToNext !== null || pointsAboveBelow !== null) && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2.5"
          style={{
            background: "rgba(0,0,0,0.20)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {/* Gap to next */}
          <div className="flex items-center gap-1.5">
            {trendIcon}
            <span className="text-[10.5px] text-[color:var(--color-muted)]">
              {pointsToNext === null ? (
                <span className="font-bold text-[#FFD93D]">המוביל!</span>
              ) : pointsToNext === 0 ? (
                <>תיקו עם המוביל</>
              ) : (
                <>
                  פער למקום <span className="num font-bold text-white">{rank - 1}</span>:{" "}
                  <span className="num font-bold text-white">{pointsToNext}</span> נק׳
                </>
              )}
            </span>
          </div>

          {/* Lead over next */}
          {pointsAboveBelow !== null && pointsAboveBelow > 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingDown size={14} color="#8A93A6" />
              <span className="text-[10.5px] text-[color:var(--color-muted)]">
                <span className="num font-bold text-white">{pointsAboveBelow}</span> מעל הבא
              </span>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

// ============================================================
// Podium — top 3 visual
// ============================================================

function Podium({ entries, myUserId }: { entries: LeaderboardEntry[]; myUserId?: string }) {
  if (entries.length === 0) return null;

  // סדר תצוגה: 2 → 1 → 3 (כדי שהזהב יהיה במרכז גבוה)
  const [first, second, third] = entries;

  return (
    <div className="grid grid-cols-3 items-end gap-2.5">
      {/* SILVER (2nd) */}
      {second ? (
        <PodiumSpot
          entry={second}
          place={2}
          isMe={second.user_id === myUserId}
        />
      ) : <div />}

      {/* GOLD (1st) — מעט מוגבה */}
      {first ? (
        <PodiumSpot
          entry={first}
          place={1}
          isMe={first.user_id === myUserId}
          tall
        />
      ) : <div />}

      {/* BRONZE (3rd) */}
      {third ? (
        <PodiumSpot
          entry={third}
          place={3}
          isMe={third.user_id === myUserId}
        />
      ) : <div />}
    </div>
  );
}

function PodiumSpot({
  entry,
  place,
  isMe,
  tall = false,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  isMe: boolean;
  tall?: boolean;
}) {
  const navigate = useNavigate();
  const colors = {
    1: { primary: "#FFD93D", secondary: "#E0B617", text: "#1A1300", shadow: "rgba(255,217,61,0.50)" },
    2: { primary: "#C8D0DD", secondary: "#8A93A6", text: "#0A0E1A", shadow: "rgba(200,208,221,0.30)" },
    3: { primary: "#CD8755", secondary: "#A06536", text: "#1A0A00", shadow: "rgba(205,135,85,0.35)" },
  }[place];

  const initial = entry.username[0]?.toUpperCase() ?? "?";

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place === 1 ? 0.2 : place === 2 ? 0.1 : 0.3, duration: 0.5 }}
      onClick={() => navigate(`/user/${entry.user_id}`)}
      className="flex flex-col items-center no-tap transition-transform active:scale-[0.97]"
      type="button"
    >
      {/* Crown (only on 1st) */}
      {place === 1 && (
        <Crown size={20} color="#FFD93D" fill="#FFD93D" style={{ marginBottom: 4 }} />
      )}

      {/* Avatar circle */}
      <div
        className="grid place-items-center rounded-full text-[18px] font-extrabold text-white"
        style={{
          width: tall ? 64 : 52,
          height: tall ? 64 : 52,
          background: "linear-gradient(135deg, #E63946, #1D3557)",
          boxShadow: `0 8px 24px -6px ${colors.shadow}, 0 0 0 2px ${colors.primary}, inset 0 0 0 1px rgba(255,255,255,0.18)`,
        }}
      >
        {initial}
      </div>

      {/* Username */}
      <p
        className="mt-2 max-w-full truncate text-center text-[12px] font-bold text-white"
        style={{ direction: "rtl" }}
      >
        {entry.username}
        {isMe && <span className="text-[#FFD93D]"> (אתה)</span>}
      </p>

      {/* Pillar */}
      <div
        className="mt-2 flex w-full flex-col items-center justify-center rounded-t-xl"
        style={{
          height: tall ? 72 : 56,
          background: `linear-gradient(180deg, ${colors.primary}, ${colors.secondary})`,
          boxShadow: `0 8px 24px -8px ${colors.shadow}, inset 0 1px 0 rgba(255,255,255,0.40)`,
        }}
      >
        <span
          className="num text-[20px] font-extrabold num-tight"
          style={{ color: colors.text, lineHeight: 1 }}
        >
          {entry.total_points}
        </span>
        <span
          className="text-[9px] font-bold uppercase opacity-70"
          style={{ color: colors.text, letterSpacing: "0.05em" }}
        >
          נק׳
        </span>
        <span
          className="num mt-1 text-[16px] font-extrabold opacity-80"
          style={{ color: colors.text }}
        >
          {place}
        </span>
      </div>
    </motion.button>
  );
}

// ============================================================
// RankRow — שורה ברשימת השאר
// ============================================================

function RankRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/user/${entry.user_id}`)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-end no-tap transition-all hover:scale-[1.005] active:scale-[0.995]"
      style={{
        background: isMe ? "rgba(230,57,70,0.10)" : "rgba(20,27,45,0.32)",
        border: `1px solid ${isMe ? "rgba(230,57,70,0.30)" : "rgba(255,255,255,0.06)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Rank number */}
      <div
        className="num grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold"
        style={{
          background: "rgba(255,255,255,0.04)",
          color: isMe ? "#FFD93D" : "#C8D0DD",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {entry.rank}
      </div>

      {/* Avatar mini */}
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
        style={{
          background: "linear-gradient(135deg, #E63946, #1D3557)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        }}
      >
        {entry.username[0]?.toUpperCase() ?? "?"}
      </div>

      {/* Name + stats */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white leading-tight">
          {entry.username}
          {isMe && <span className="ms-1 text-[10px] font-bold text-[#FFD93D]">(אתה)</span>}
        </p>
        <p className="num mt-0.5 text-[10px] text-[color:var(--color-muted)]">
          <span className="num-tight font-bold text-white/80">{entry.correct_count}</span>/
          <span className="num-tight">{entry.total_predictions}</span> ניחושים נכונים
        </p>
      </div>

      {/* Points */}
      <div className="text-end">
        <span
          className="num text-[17px] font-extrabold num-tight"
          style={{ color: isMe ? "#FFD93D" : "#F4F6FB" }}
        >
          {entry.total_points}
        </span>
        <span className="ms-1 text-[9.5px] font-medium text-[color:var(--color-muted)]">נק׳</span>
        {entry.double_down_pts > 0 && (
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span className="text-[9px] text-[color:var(--color-muted)]">DD</span>
            <span className="num text-[9px] font-bold text-[#06A77D]">+{entry.double_down_pts}</span>
          </div>
        )}
      </div>
    </button>
  );
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
