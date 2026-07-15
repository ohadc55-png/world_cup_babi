// "מי ניחש מה" — תצוגת ניחושי טווח-ארוך של כל חברי הקבוצה.
//
// 2 תצוגות (toggle בראש):
//   - "קטגוריה": סקשן לכל קטגוריה, כל חבר → הבחירה שלו
//   - "משתמש":   כרטיס לכל חבר עם כל 7 הבחירות
//
// ה-toggle נשמר ב-URL כ-?view=category|user (default: category).

import { useSearchParams } from "react-router-dom";
import { Trophy, Medal, Crown, Star, Goal, Users } from "lucide-react";
import { useAllTournamentPredictions } from "@/hooks/useTournamentPredictions";
import { getTeamInfo } from "@/lib/teams";
import type { MemberTournamentPrediction } from "@/types";

type ViewMode = "category" | "user";
const VALID_VIEW: ViewMode[] = ["category", "user"];

export function WhoPickedWhatView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view") as ViewMode | null;
  const view: ViewMode = viewParam && VALID_VIEW.includes(viewParam) ? viewParam : "category";

  function setView(v: ViewMode) {
    const next = new URLSearchParams(searchParams);
    next.set("view", v);
    setSearchParams(next, { replace: false });
  }

  const { data, loading, error } = useAllTournamentPredictions();

  return (
    <section className="px-5 pt-3 pb-4">
      <SectionHeader title="מי ניחש מה" />

      {/* Toggle */}
      <div className="mb-4 grid grid-cols-2 gap-1.5">
        {([
          { key: "category", label: "לפי קטגוריה" },
          { key: "user", label: "לפי משתתף" },
        ] as { key: ViewMode; label: string }[]).map(({ key, label }) => {
          const isActive = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
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

      {loading && (
        <p className="py-8 text-center text-[12px] text-[color:var(--color-muted)]">טוען...</p>
      )}

      {!loading && error && (
        <div
          className="rounded-2xl px-5 py-6 text-center text-[13px]"
          style={{
            background: "rgba(20,27,45,0.45)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--color-muted)",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && data && data.length === 0 && <EmptyState />}

      {!loading && !error && data && data.length > 0 && (
        view === "category" ? <CategoryView preds={data} /> : <UserView preds={data} />
      )}
    </section>
  );
}

// ============================================================
// SectionHeader — eyebrow זהוב + hairline (זהה ל-Leaderboard ו-TopAthletesTable)
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
// EmptyState — אין חברים בקבוצה (יחיד או טרם נוצרו ניחושים)
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
        <Users size={24} color="#FFD93D" />
      </div>
      <p className="text-[14px] font-bold text-white">אין עוד מה להציג</p>
      <p className="text-[11px] text-[color:var(--color-muted)]">
        יוצגו כאן ניחושי הטווח-ארוך של חברי הקבוצה.
      </p>
    </div>
  );
}

// ============================================================
// CategoryView — סקשן לכל קטגוריה
// ============================================================

type CategoryDef = {
  key: string;
  title: string;
  Icon: typeof Trophy;
  accent: string;
  /** מחזיר את הערך הגולמי של המשתמש לקטגוריה הזו (string או null) */
  pick: (p: MemberTournamentPrediction) => string | null;
  /** האם זו קבוצה (להציג דגל) או שחקן (טקסט בלבד) */
  isTeam: boolean;
  /** עבור שחקנים — אם יש שם קנוני, להציג אותו במקום הטקסט הגולמי */
  canonical?: (p: MemberTournamentPrediction) => string | null;
};

const CATEGORIES: CategoryDef[] = [
  { key: "winner", title: "אלופה", Icon: Crown, accent: "#FFD93D",
    pick: (p) => p.winner, isTeam: true },
  { key: "finalist_1", title: "פיינליסטית 1", Icon: Medal, accent: "#C8D0DD",
    pick: (p) => p.finalist_1, isTeam: true },
  { key: "finalist_2", title: "פיינליסטית 2", Icon: Medal, accent: "#C8D0DD",
    pick: (p) => p.finalist_2, isTeam: true },
  { key: "semifinalist_1", title: "חצי-גמרנית 1", Icon: Star, accent: "#9BBAEA",
    pick: (p) => p.semifinalist_1, isTeam: true },
  { key: "semifinalist_2", title: "חצי-גמרנית 2", Icon: Star, accent: "#9BBAEA",
    pick: (p) => p.semifinalist_2, isTeam: true },
  { key: "semifinalist_3", title: "חצי-גמרנית 3", Icon: Star, accent: "#9BBAEA",
    pick: (p) => p.semifinalist_3, isTeam: true },
  { key: "semifinalist_4", title: "חצי-גמרנית 4", Icon: Star, accent: "#9BBAEA",
    pick: (p) => p.semifinalist_4, isTeam: true },
  { key: "top_scorer", title: "מלך שערים", Icon: Goal, accent: "#06A77D",
    pick: (p) => p.top_scorer, isTeam: false, canonical: (p) => p.top_scorer_canonical },
  { key: "top_assister", title: "מלך בישולים", Icon: Goal, accent: "#06A77D",
    pick: (p) => p.top_assister, isTeam: false, canonical: (p) => p.top_assister_canonical },
  { key: "golden_ball", title: "כדור הזהב", Icon: Trophy, accent: "#FFD93D",
    pick: (p) => p.golden_ball, isTeam: false },
];

function CategoryView({ preds }: { preds: MemberTournamentPrediction[] }) {
  return (
    <div className="flex flex-col gap-4">
      {CATEGORIES.map((cat) => {
        const picks = preds
          .map((p) => ({ user: p, value: cat.pick(p), canonical: cat.canonical?.(p) ?? null }))
          .filter((x) => x.value && x.value.trim() !== "");
        return (
          <div
            key={cat.key}
            className="rounded-2xl"
            style={{
              background: "rgba(20,27,45,0.55)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              border: `1px solid ${cat.accent}25`,
              boxShadow: `0 8px 24px -12px ${cat.accent}30`,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 rounded-t-2xl px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                style={{ background: `${cat.accent}15`, border: `1px solid ${cat.accent}40` }}
              >
                <cat.Icon size={14} color={cat.accent} />
              </div>
              <h3 className="text-[13.5px] font-extrabold text-white">{cat.title}</h3>
              <span className="ms-auto text-[10.5px] text-[color:var(--color-muted)]">
                <span className="num font-bold text-white">{picks.length}</span>/{preds.length}
              </span>
            </div>

            {/* Rows */}
            {picks.length === 0 ? (
              <p className="px-4 py-3 text-[11px] text-[color:var(--color-muted)]">
                אף אחד לא ניחש.
              </p>
            ) : (
              <div className="flex flex-col">
                {picks.map(({ user, value, canonical }) => (
                  <PickRow
                    key={user.user_id}
                    username={user.username}
                    avatar_url={user.avatar_url}
                    value={value!}
                    canonical={canonical}
                    isTeam={cat.isTeam}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PickRow({
  username, avatar_url, value, canonical, isTeam,
}: {
  username: string;
  avatar_url: string | null;
  value: string;
  canonical: string | null;
  isTeam: boolean;
}) {
  const team = isTeam ? getTeamInfo(value) : null;
  const displayValue = isTeam ? team!.he : (canonical || value);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Avatar / initial */}
      <UserBadge username={username} avatarUrl={avatar_url} />
      <span className="truncate text-[12.5px] font-bold text-white">{username}</span>
      {/* Pick — pushed to the left edge */}
      <div className="flex flex-1 items-center justify-end gap-1.5">
        {isTeam && <span className="text-[15px]">{team!.flag}</span>}
        <span className="truncate text-[12.5px] font-extrabold text-white">{displayValue}</span>
      </div>
    </div>
  );
}

// ============================================================
// UserView — כרטיס לכל חבר עם 7 בחירות
// ============================================================

function UserView({ preds }: { preds: MemberTournamentPrediction[] }) {
  return (
    <div className="flex flex-col gap-3">
      {preds.map((p) => (
        <UserCard key={p.user_id} pred={p} />
      ))}
    </div>
  );
}

// item = בחירה בודדת עם הניקוד שלה (pts: null=pending, number=determined)
type SlotItem = { value: string; pts: number | null };

function UserCard({ pred }: { pred: MemberTournamentPrediction }) {
  const pts = pred.points;
  const finalists: SlotItem[] = [
    { value: pred.finalist_1, pts: pts?.finalist_1 ?? null },
    { value: pred.finalist_2, pts: pts?.finalist_2 ?? null },
  ].filter((x) => x.value) as SlotItem[];
  const semis: SlotItem[] = [
    { value: pred.semifinalist_1, pts: pts?.semifinalist_1 ?? null },
    { value: pred.semifinalist_2, pts: pts?.semifinalist_2 ?? null },
    { value: pred.semifinalist_3, pts: pts?.semifinalist_3 ?? null },
    { value: pred.semifinalist_4, pts: pts?.semifinalist_4 ?? null },
  ].filter((x) => x.value) as SlotItem[];

  // סה"כ נקודות טווח-ארוך שנקבעו עד כה (סכום כל השדות המספריים)
  const total = pts
    ? Object.values(pts).reduce<number>((sum, v) => sum + (typeof v === "number" ? v : 0), 0)
    : 0;
  const hasDetermined = pts
    ? Object.values(pts).some((v) => typeof v === "number")
    : false;

  return (
    <div
      className="rounded-2xl"
      style={{
        background: "rgba(20,27,45,0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{
          background: "linear-gradient(90deg, rgba(255,217,61,0.06), transparent 70%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <UserBadge username={pred.username} avatarUrl={pred.avatar_url} large />
        <span className="truncate text-[14px] font-extrabold text-white">{pred.username}</span>
        {hasDetermined && (
          <span
            className="ms-auto num rounded-full px-2.5 py-1 text-[12px] font-extrabold"
            style={{ background: "rgba(255,217,61,0.14)", border: "1px solid rgba(255,217,61,0.35)", color: "#FFD93D" }}
          >
            {total} נק׳
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        <UserCardRow
          label="אלופה"
          items={pred.winner ? [{ value: pred.winner, pts: pts?.winner ?? null }] : []}
          isTeam Icon={Crown} accent="#FFD93D"
        />
        <UserCardRow
          label="פיינליסטיות" items={finalists} isTeam Icon={Medal} accent="#C8D0DD"
          bonus={pts?.finalists_bonus ?? null}
        />
        <UserCardRow
          label="חצי-גמרניות" items={semis} isTeam Icon={Star} accent="#9BBAEA"
          bonus={pts?.semifinalists_bonus ?? null}
        />
        <UserCardRow
          label="מלך שערים"
          items={(pred.top_scorer_canonical || pred.top_scorer)
            ? [{ value: (pred.top_scorer_canonical || pred.top_scorer)!, pts: pts?.top_scorer ?? null }] : []}
          isTeam={false} Icon={Goal} accent="#06A77D"
        />
        <UserCardRow
          label="מלך בישולים"
          items={(pred.top_assister_canonical || pred.top_assister)
            ? [{ value: (pred.top_assister_canonical || pred.top_assister)!, pts: pts?.top_assister ?? null }] : []}
          isTeam={false} Icon={Goal} accent="#06A77D"
        />
        <UserCardRow
          label="כדור הזהב"
          items={pred.golden_ball ? [{ value: pred.golden_ball, pts: pts?.golden_ball ?? null }] : []}
          isTeam={false} Icon={Trophy} accent="#FFD93D"
        />
      </div>
    </div>
  );
}

// pill נקודות: null=pending (לא מציג), 0=אפור, חיובי=ירוק
function PointsPill({ pts }: { pts: number | null }) {
  if (pts === null) return null;
  const positive = pts > 0;
  return (
    <span
      className="num shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold"
      style={
        positive
          ? { background: "rgba(6,167,125,0.18)", border: "1px solid rgba(6,167,125,0.45)", color: "#3DDC97" }
          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-muted)" }
      }
    >
      {positive ? `+${pts}` : "0"}
    </span>
  );
}

function UserCardRow({
  label, items, isTeam, Icon, accent, bonus = null,
}: {
  label: string;
  items: SlotItem[];
  isTeam: boolean;
  Icon: typeof Trophy;
  accent: string;
  bonus?: number | null;
}) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md"
        style={{ background: `${accent}15`, border: `1px solid ${accent}35` }}
      >
        <Icon size={11} color={accent} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <span className="text-[11.5px] font-bold text-white/85">{label}</span>
        {bonus !== null && bonus > 0 && (
          <span
            className="num rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold"
            style={{ background: "rgba(255,217,61,0.15)", border: "1px solid rgba(255,217,61,0.35)", color: "#FFD93D" }}
          >
            בונוס +{bonus}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-1">
        {items.length === 0 ? (
          <span className="text-[11px] text-[color:var(--color-muted)]">—</span>
        ) : (
          items.map((it, i) => {
            const team = isTeam ? getTeamInfo(it.value) : null;
            const display = isTeam ? team!.he : it.value;
            return (
              <span key={`${it.value}-${i}`} className="inline-flex items-center gap-1">
                {isTeam && <span className="text-[14px]">{team!.flag}</span>}
                <span className="text-[12.5px] font-extrabold text-white">{display}</span>
                <PointsPill pts={it.pts} />
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// UserBadge — אווטר עגול עם initial fallback
// ============================================================

function UserBadge({
  username, avatarUrl, large = false,
}: { username: string; avatarUrl: string | null; large?: boolean }) {
  const size = large ? 28 : 22;
  const initial = (username[0] || "?").toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="shrink-0 grid place-items-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #E63946, #1D3557)",
        fontSize: large ? 12 : 10,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
      }}
    >
      {initial}
    </div>
  );
}
