// עמוד פרופיל ציבורי של חבר במשחק.
//
// נגיש מ-`/user/:id` (לחיצה על שורה בלידרבורד / פודיום).
// תצוגה:
// - כותרת: שם משתמש + סה"כ נקודות + rank
// - 3 טאבים: ניחושי משחקים / ניחושי בתים / ניחוש ארוך טווח
//
// חשיפת מידע:
// - tournament_has_started=false  →  כל הניחושים מוסתרים (אלא אם is_me)
// - לכל משחק: ניחוש ספציפי מוצג רק אם המשחק נעול/חי/הסתיים (אלא אם is_me)
//   (זה כבר נאכף ב-backend; הקליינט פשוט מציג מה שהגיע)

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Lock, Crown, Trophy, Star, Target, Award, Flame,
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getTeamInfo } from "@/lib/teams";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";
import type { GroupBreakdownItem, ProfileMatchPrediction, ProfileGroupPrediction, ProfileTournament, Stage } from "@/types";

type Tab = "matches" | "groups" | "longterm";

const TABS: { key: Tab; label: string }[] = [
  { key: "matches", label: "ניחושי משחקים" },
  { key: "groups", label: "ניחושי בתים" },
  { key: "longterm", label: "טווח ארוך" },
];

const STAGE_HE: Record<Stage, string> = {
  group: "שלב הבתים",
  r32: "סבב 32",
  r16: "שמינית",
  qf: "רבע",
  sf: "חצי",
  third_place: "מקומות 3-4",
  final: "גמר",
};

export function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: profile, loading, error } = useUserProfile(id ?? null);
  const [activeTab, setActiveTab] = useState<Tab>("matches");

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <p className="text-sm text-[color:var(--color-muted)]">טוען...</p>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3" style={{ background: "var(--color-bg)" }}>
        <p className="text-sm" style={{ color: "var(--color-error)" }}>{error ?? "פרופיל לא נמצא"}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-white/70 underline">חזרה</button>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc6.jpg" intensity="balanced" />
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

        <main className="px-5 pt-3">
          {/* === Profile card === */}
          <ProfileHeader profile={profile} />

          {/* === Per-group breakdown === */}
          {profile.per_group && profile.per_group.length > 0 && (
            <PerGroupSection
              items={profile.per_group}
              onClickGroup={(g) => navigate(`/group/${g}`)}
            />
          )}

          {/* === Tabs === */}
          <div className="mt-5 grid grid-cols-3 gap-1.5">
            {TABS.map(({ key, label }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
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
                  <p className={`text-[12px] font-extrabold ${isActive ? "text-white" : "text-white/85"}`}>
                    {label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* === Tab content === */}
          <div className="mt-5">
            {!profile.tournament_has_started && !profile.is_me ? (
              <HiddenUntilStart username={profile.username} />
            ) : (
              <>
                {activeTab === "matches" && (
                  <MatchesList preds={profile.match_predictions} isMe={profile.is_me} />
                )}
                {activeTab === "groups" && (
                  <GroupsList preds={profile.group_predictions} />
                )}
                {activeTab === "longterm" && (
                  <LongTermView pred={profile.tournament_predictions} />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// ProfileHeader — שם + נקודות + rank + פירוט קטגוריות
// ============================================================

function ProfileHeader({ profile }: { profile: ReturnType<typeof useUserProfile>["data"] }) {
  if (!profile) return null;
  const { username, score, is_me, is_owner, rank } = { ...profile, rank: profile.score.rank };
  const initial = username[0]?.toUpperCase() ?? "?";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl p-5"
      style={{
        background: "rgba(20,27,45,0.55)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: "1.5px solid rgba(255,255,255,0.10)",
        boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[24px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg, #E63946, #1D3557)",
            boxShadow: "0 8px 20px -6px rgba(230,57,70,0.45), inset 0 0 0 2px rgba(255,255,255,0.20)",
          }}
        >
          {initial}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[18px] font-extrabold text-white leading-tight">
              {username}
            </p>
            {is_owner && <Crown size={14} color="#FFD93D" fill="#FFD93D" />}
            {is_me && (
              <span className="text-[10px] font-bold text-[#FFD93D]">(אתה)</span>
            )}
          </div>
          {rank && (
            <p className="num mt-1 text-[11px] text-[color:var(--color-muted)]">
              מקום <span className="font-bold text-white">{rank}</span>
            </p>
          )}
        </div>

        {/* Total points */}
        <div className="text-end">
          <p className="num text-[28px] font-extrabold leading-none num-tight" style={{ color: "#FFD93D" }}>
            {score.total_points}
          </p>
          <p className="text-[10px] font-medium text-[color:var(--color-muted)] mt-1">נקודות</p>
        </div>
      </div>

      {/* Breakdown chips — 5 קטגוריות:
          "בתים" של scoring.py מפוצל פה ל-group_match_pts + group_standings_pts */}
      {score.total_points > 0 && (
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          <StatChip label="מ. בתים" value={score.group_match_pts} color="#06A77D" />
          <StatChip label="ד. בתים" value={score.group_standings_pts} color="#3DDC97" />
          <StatChip label="פלייאוף" value={score.knockout_pts} color="#5B9EFF" />
          <StatChip label="פרסים" value={score.awards_pts} color="#FFD93D" />
          <StatChip label="בונוס" value={score.double_down_pts} color="#FF7A85" icon={<Flame size={10} />} />
        </div>
      )}
    </motion.section>
  );
}

function StatChip({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl py-2 px-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-1">
        {icon}
        <span className="num text-[14px] font-extrabold num-tight" style={{ color }}>
          {value}
        </span>
      </div>
      <span className="text-[9.5px] text-[color:var(--color-muted)] mt-0.5">{label}</span>
    </div>
  );
}

// ============================================================
// PerGroupSection — ניקוד-לפי-בית (גריד 2×6 כרטיסים A..L)
// ============================================================
// כל כרטיס מציג: אות הבית, סכום נקודות (משחקים + דירוג), והתקדמות (4/6).
// בית סגור (6/6) מקבל גוון זהוב + ה-standings מופיע נפרד.
// לחיצה על כרטיס פותחת את עמוד הבית.

function PerGroupSection({
  items,
  onClickGroup,
}: {
  items: GroupBreakdownItem[];
  onClickGroup: (groupName: string) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="mt-4"
    >
      {/* Section header */}
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2
          className="text-[11px] font-extrabold uppercase"
          style={{ color: "#FFD93D", letterSpacing: "0.22em" }}
        >
          ניקוד לפי בית
        </h2>
        <span className="text-[9.5px] text-white/40">לחיצה לפתיחת הבית</span>
      </div>
      <div
        className="mb-3 h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,217,61,0.40) 0%, rgba(255,217,61,0.06) 60%, transparent 100%)",
        }}
      />

      {/* 2×6 grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((g) => (
          <GroupBreakdownCard key={g.group_name} g={g} onClick={() => onClickGroup(g.group_name)} />
        ))}
      </div>
    </motion.section>
  );
}

function GroupBreakdownCard({
  g,
  onClick,
}: {
  g: GroupBreakdownItem;
  onClick: () => void;
}) {
  const totalPts = g.match_pts + g.standings_pts;
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid items-center gap-2 rounded-xl px-2.5 py-2 text-end no-tap transition-transform active:scale-[0.985]"
      style={{
        gridTemplateColumns: "28px 1fr auto",
        background: g.is_complete
          ? "linear-gradient(135deg, rgba(255,217,61,0.10), rgba(6,167,125,0.05))"
          : "rgba(20,27,45,0.45)",
        border: `1px solid ${g.is_complete ? "rgba(255,217,61,0.40)" : "rgba(255,255,255,0.06)"}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Group letter badge */}
      <div
        className="grid h-6 w-6 place-items-center rounded-md text-[12px] font-extrabold"
        style={{
          background: g.is_complete ? "#FFD93D" : "rgba(255,255,255,0.10)",
          color: g.is_complete ? "#1A1300" : "rgba(255,255,255,0.85)",
        }}
      >
        {g.group_name}
      </div>

      {/* Middle column: match + standings split (when complete) or progress (when in progress) */}
      <div className="min-w-0 text-end">
        {g.is_complete ? (
          <p className="text-[9.5px] text-white/55 leading-tight">
            <span className="num font-bold text-white/85">{g.match_pts}</span> משחקים
            {g.standings_pts > 0 && (
              <>
                {" · "}
                <span className="num font-bold text-[#FFD93D]">{g.standings_pts}</span> דירוג
              </>
            )}
          </p>
        ) : (
          <p className="num text-[10px] text-white/45 leading-tight">
            <span className="font-bold text-white/70">{g.matches_finished}</span>/{g.matches_total} משחקים
          </p>
        )}
      </div>

      {/* Total points */}
      <div className="text-end" style={{ direction: "ltr" }}>
        <span
          className="num text-[16px] font-extrabold num-tight leading-none"
          style={{
            color: totalPts > 0 ? (g.is_complete ? "#FFD93D" : "#06A77D") : "rgba(255,255,255,0.30)",
            letterSpacing: "-0.03em",
          }}
        >
          {totalPts}
        </span>
        <span className="ms-0.5 text-[8.5px] font-medium text-white/40">נק'</span>
      </div>
    </button>
  );
}


// ============================================================
// HiddenUntilStart — חשיפה רק כשהמונדיאל מתחיל
// ============================================================

function HiddenUntilStart({ username }: { username: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl p-8 text-center"
      style={{
        background: "rgba(20,27,45,0.40)",
        border: "1.5px dashed rgba(255,255,255,0.12)",
      }}
    >
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: "rgba(255,217,61,0.10)",
          border: "1px solid rgba(255,217,61,0.20)",
        }}
      >
        <Lock size={22} color="#FFD93D" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-white">הניחושים של {username} נחשפים בתחילת המונדיאל</p>
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-muted)]">
          עד אז — כל אחד שומר את ההימורים שלו לעצמו 🤐
        </p>
      </div>
    </div>
  );
}

// ============================================================
// MatchesList — רשימת ניחושי משחקים (קבוצות לפי שלב)
// ============================================================

function MatchesList({ preds, isMe }: { preds: ProfileMatchPrediction[]; isMe: boolean }) {
  // קיבוץ לפי שלב; שלב הבתים נחלק נוסף לפי מחזור
  const grouped = useMemo(() => {
    const groups = new Map<string, ProfileMatchPrediction[]>();
    for (const p of preds) {
      let key: string;
      if (p.stage === "group" && p.group_round) {
        key = `שלב הבתים · מחזור ${p.group_round}`;
      } else {
        key = STAGE_HE[p.stage] ?? p.stage;
      }
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [preds]);

  if (preds.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
        אין ניחושי משחקים
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([sectionLabel, list]) => (
        <section key={sectionLabel}>
          <p className="eyebrow mb-2 px-1">{sectionLabel}</p>
          <div className="flex flex-col gap-2">
            {list.map((p) => (
              <MatchPredRow key={p.match_id} pred={p} isMe={isMe} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchPredRow({ pred, isMe }: { pred: ProfileMatchPrediction; isMe: boolean }) {
  const home = getTeamInfo(pred.team_home);
  const away = getTeamInfo(pred.team_away);
  const isPlayed = pred.match_status === "live" || pred.match_status === "finished";
  const hasPrediction = pred.direction !== null;
  const isHiddenForMe = !isMe && !isPlayed && !hasPrediction;
  // ההנחה: אם backend לא החזיר direction אבל המשחק נעול → לא ניחש; אם backend העלים בכוונה → גם direction null.
  // ב-tournament_has_started=true פלוס משחק לא נעול וגם לא is_me → backend מעלים, isHiddenForMe=true.

  // צבע מסביב לפי תוצאה
  let borderTint = "rgba(255,255,255,0.08)";
  let pointsColor = "#C8D0DD";
  if (pred.points_earned !== null) {
    if (pred.points_earned > 0) {
      borderTint = "rgba(6,167,125,0.28)";
      pointsColor = "#06A77D";
    } else {
      borderTint = "rgba(230,57,70,0.20)";
      pointsColor = "#FF7A85";
    }
  }

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(20,27,45,0.42)",
        border: `1px solid ${borderTint}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* Teams row */}
      <div className="flex items-center justify-center gap-2 text-[13px] font-bold text-white">
        <span className="text-lg">{home.flag}</span>
        <span className="truncate">{home.he}</span>
        {isPlayed && pred.match_score_home !== null && pred.match_score_away !== null ? (
          <span className="num mx-1 text-[13px] font-extrabold text-white">
            {pred.match_score_away}–{pred.match_score_home}
          </span>
        ) : (
          <span className="num mx-1 text-[10px] font-medium text-[color:var(--color-muted)]">VS</span>
        )}
        <span className="truncate">{away.he}</span>
        <span className="text-lg">{away.flag}</span>
      </div>

      {/* Prediction row */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 text-[11px]">
          {isHiddenForMe ? (
            <>
              <Lock size={11} color="#8A93A6" />
              <span className="text-[color:var(--color-muted)]">ניחוש מוסתר עד נעילה</span>
            </>
          ) : hasPrediction ? (
            <>
              <span className="text-[color:var(--color-muted)]">ניחש:</span>
              {pred.pred_score_home !== null && pred.pred_score_away !== null ? (
                <span className="num font-bold text-white">
                  {pred.pred_score_away}–{pred.pred_score_home}
                </span>
              ) : (
                <span className="num font-bold text-white">
                  {pred.direction === "1" ? home.he : pred.direction === "2" ? away.he : "תיקו"}
                </span>
              )}
              {pred.has_double_down && (
                <span className="ms-1 flex items-center gap-0.5" title="Double Down">
                  <Flame size={11} color="#FF7A85" />
                  <span className="text-[9.5px] font-bold text-[#FF7A85]">×2</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-[color:var(--color-muted)]">לא ניחש</span>
          )}
        </div>

        {pred.points_earned !== null && (
          <div className="flex items-center gap-1">
            <span className="num text-[13px] font-extrabold num-tight" style={{ color: pointsColor }}>
              {pred.points_earned > 0 ? `+${pred.points_earned}` : pred.points_earned}
            </span>
            <span className="text-[9.5px] text-[color:var(--color-muted)]">נק׳</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// GroupsList — 12 ניחושי בתים
// ============================================================

function GroupsList({ preds }: { preds: ProfileGroupPrediction[] }) {
  if (preds.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
        לא ניחש בתים
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {preds.map((g) => (
        <GroupPredCard key={g.group_name} g={g} />
      ))}
    </div>
  );
}

function GroupPredCard({ g }: { g: ProfileGroupPrediction }) {
  const positions: { num: number; team: string | null; label: string }[] = [
    { num: 1, team: g.team_1st, label: "🥇" },
    { num: 2, team: g.team_2nd, label: "🥈" },
    { num: 3, team: g.team_3rd, label: "🥉" },
    { num: 4, team: g.team_4th, label: "4" },
  ];

  let pointsColor = "#C8D0DD";
  if (g.points_earned !== null) {
    if (g.points_earned >= 15) pointsColor = "#FFD93D";
    else if (g.points_earned > 0) pointsColor = "#06A77D";
    else pointsColor = "#FF7A85";
  }

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: "rgba(20,27,45,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[12px] font-extrabold text-white">בית {g.group_name}</p>
        {g.points_earned !== null && (
          <span className="num text-[13px] font-extrabold num-tight" style={{ color: pointsColor }}>
            {g.points_earned > 0 ? `+${g.points_earned}` : g.points_earned}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {positions.map((p) => {
          const team = p.team ? getTeamInfo(p.team) : null;
          return (
            <div key={p.num} className="flex items-center gap-2 text-[12px]">
              <span className="num w-5 text-center text-[11px] text-[color:var(--color-muted)]">{p.label}</span>
              {team ? (
                <>
                  <span className="text-base">{team.flag}</span>
                  <span className="font-medium text-white truncate">{team.he}</span>
                </>
              ) : (
                <span className="text-[color:var(--color-muted)]">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// LongTermView — ניחוש ארוך טווח
// ============================================================

function LongTermView({ pred }: { pred: ProfileTournament | null }) {
  if (!pred) {
    return (
      <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
        לא ניחש טווח ארוך
      </p>
    );
  }

  const items: { icon: React.ReactNode; label: string; value: string | null; highlight?: boolean }[] = [
    { icon: <Trophy size={14} color="#FFD93D" />, label: "אלופה", value: pred.winner, highlight: true },
    { icon: <Award size={14} color="#C8D0DD" />, label: "פיינליסטית", value: pred.finalist_1 },
    { icon: <Award size={14} color="#C8D0DD" />, label: "פיינליסטית", value: pred.finalist_2 },
    { icon: <Star size={14} color="#5B9EFF" />, label: "חצי גמרניות", value: pred.semifinalist_1 },
    { icon: <Star size={14} color="#5B9EFF" />, label: "חצי גמרניות", value: pred.semifinalist_2 },
    { icon: <Star size={14} color="#5B9EFF" />, label: "חצי גמרניות", value: pred.semifinalist_3 },
    { icon: <Star size={14} color="#5B9EFF" />, label: "חצי גמרניות", value: pred.semifinalist_4 },
    { icon: <Target size={14} color="#FF7A85" />, label: "מלך השערים", value: pred.top_scorer },
    { icon: <Target size={14} color="#06A77D" />, label: "מלך הבישולים", value: pred.top_assister },
    { icon: <Crown size={14} color="#FFD93D" />, label: "כדור הזהב", value: pred.golden_ball },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {pred.points_earned !== null && (
        <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,217,61,0.08)", border: "1px solid rgba(255,217,61,0.18)" }}>
          <span className="num text-[18px] font-extrabold num-tight" style={{ color: "#FFD93D" }}>
            +{pred.points_earned}
          </span>
          <span className="ms-1 text-[11px] text-[color:var(--color-muted)]">נק׳ סה"כ</span>
        </div>
      )}
      {items.map((item, idx) => (
        <LongTermRow key={idx} {...item} />
      ))}
    </div>
  );
}

function LongTermRow({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  const team = value ? getTeamInfo(value) : null;
  const isTeam = !!(team && team.flag !== "🏳️");
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: highlight ? "rgba(255,217,61,0.06)" : "rgba(20,27,45,0.40)",
        border: `1px solid ${highlight ? "rgba(255,217,61,0.20)" : "rgba(255,255,255,0.06)"}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] text-[color:var(--color-muted)]">{label}</span>
      </div>
      {value ? (
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
          {isTeam && <span className="text-base">{team!.flag}</span>}
          <span>{isTeam ? team!.he : value}</span>
        </div>
      ) : (
        <span className="text-[11px] text-[color:var(--color-muted)]">לא נבחר</span>
      )}
    </div>
  );
}
