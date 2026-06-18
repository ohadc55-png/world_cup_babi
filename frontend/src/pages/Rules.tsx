// עמוד "חוקים ושיטת ניקוד" — מסביר למשתמשים איך עובד המשחק.
//
// עיצוב 2026-05-24:
// - TL;DR cards למעלה (3 דוגמאות מהירות)
// - sections עם דוגמאות "אם תניחש X, תקבל Y"
// - icons + צבעים בולטים לקטגוריות
// - פחות טקסט, יותר ויזואלי
//
// הקבועים הקשיחים תואמים ל-backend/app/core/constants.py.
// בכל שינוי ניקוד — לעדכן את שני הקבצים.

import { motion } from "framer-motion";
import {
  ArrowRight, Clock, Lock, Trophy, Star, Award, Goal,
  Zap, Calculator, Info, CheckCircle2, Target, Crown,
  Sparkles, Flame,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { PageBackground } from "@/components/layout/PageBackground";

export function Rules() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-dvh pb-24" style={{ background: "var(--color-bg)" }}>
      <PageBackground src="/img/wc3.png" intensity="balanced" />
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
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 no-tap"
            aria-label="חזרה"
          >
            <ArrowRight size={18} color="#F4F6FB" />
          </button>
          <Logo size={24} showWordmark showTagline />
        </div>
      </header>

      <main className="px-5 pt-3 flex flex-col gap-5">
        {/* === HERO === */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl p-6 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,217,61,0.12) 0%, rgba(255,170,0,0.04) 100%)",
            border: "1.5px solid rgba(255,217,61,0.32)",
            boxShadow: "0 12px 36px -12px rgba(255,170,0,0.25)",
          }}
        >
          <div className="flex justify-center">
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{
                background: "rgba(255,217,61,0.18)",
                border: "1px solid rgba(255,217,61,0.45)",
              }}
            >
              <Info size={24} color="#FFD93D" />
            </div>
          </div>
          <h1 className="hbrw-display mt-4 text-[22px] text-white">איך זה עובד?</h1>
          <p className="mt-1.5 text-[12.5px] text-[color:var(--color-muted)]">
            כל מה שצריך לדעת על הניחושים והניקוד
          </p>
        </motion.section>

        {/* === TL;DR — 3 examples === */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 px-1">
            <Sparkles size={14} color="#FFD93D" />
            <span className="eyebrow">בקצרה</span>
          </div>
          <ExampleCard
            icon={<Target size={18} color="#9BBAEA" />}
            tone="blue"
            scenario="ניחשת רק כיוון נכון"
            example="ניחוש: ברזיל 2–1 · בפועל: ברזיל 3–0"
            result="+3 נק׳"
          />
          <ExampleCard
            icon={<CheckCircle2 size={18} color="#06A77D" />}
            tone="green"
            scenario="ניחשת תוצאה מדויקת"
            example="ניחוש: 2–1 · בפועל: 2–1"
            result="+6 נק׳"
          />
          <ExampleCard
            icon={<Flame size={18} color="#FFD93D" />}
            tone="gold"
            scenario="ניחשת תוצאה בגמר!"
            example="ניחוש בגמר: 1–0 · בפועל: 1–0"
            result="+100 נק׳"
          />
        </motion.section>

        {/* ============================================ */}
        {/*   GROUP STAGE                                */}
        {/* ============================================ */}
        <BigSection
          color="#9BBAEA"
          icon={<Goal size={18} color="#9BBAEA" />}
          title="שלב הבתים"
          subtitle="72 משחקים · 12 בתים"
        >
          <ScoreRow points="3" label="כיוון נכון (1/X/2)" />
          <ScoreRow points="6" label="תוצאה מדויקת" highlight note="סה״כ — לא בנוסף לכיוון" />
          <ScoreRow points="+1" label="ניחשת תיקו" small />

          <MiniDivider />
          <SubHeader>טבלת סיום הבית</SubHeader>
          <ScoreRow points="5" label="כל מיקום נכון (1–4)" />
          <ScoreRow points="+10" label="בונוס: כל 4 המיקומים נכון" highlight small />
          <MaxCard label="מקסימום לבית" pts="30 נק׳" />
        </BigSection>

        {/* ============================================ */}
        {/*   KNOCKOUT                                   */}
        {/* ============================================ */}
        <BigSection
          color="#E63946"
          icon={<Target size={18} color="#E63946" />}
          title="פלייאוף"
          subtitle="ככל שמתקדמים — יותר נקודות"
        >
          <KnockoutStageRow stage="סבב 32" winner={10} exact={5} max={15} />
          <KnockoutStageRow stage="שמינית גמר" winner={15} exact={8} max={23} />
          <KnockoutStageRow stage="רבע גמר" winner={25} exact={10} max={35} />
          <KnockoutStageRow stage="חצי גמר" winner={35} exact={15} max={50} />
          <KnockoutStageRow stage="מקומות 3-4" winner={35} exact={15} max={50} />
          <KnockoutStageRow stage="הגמר 🏆" winner={50} exact={50} max={100} highlight />

          <Tip>
            <strong className="text-white">פנדלים:</strong> כל הניקוד בפלייאוף מבוסס על 90 דקות בלבד.
            פנדלים <strong className="text-white">לא משפיעים</strong> על הניקוד (הם רק קובעים מי עלה הלאה לברקט).
            <br />
            דוגמה: 90 דק' הסתיימו 2–2 (פנדלים 5–4) — מי שניחש "2–2" מקבל גם כיוון (תיקו) וגם בונוס מדויק, גם אם הקבוצה שלו פסדה בפנדלים.
          </Tip>
        </BigSection>

        {/* ============================================ */}
        {/*   LONGTERM (מצטיינים)                        */}
        {/* ============================================ */}
        <BigSection
          color="#FFD93D"
          icon={<Trophy size={18} color="#FFD93D" />}
          title="ניחושי טווח-ארוך"
          subtitle="לפני שהמונדיאל מתחיל · נעולים שעה לפני המשחק הראשון"
        >
          <LongTermItem
            icon={<Crown size={14} color="#FFD93D" />}
            label="אלופת המונדיאל"
            pts="100"
            highlight
          />

          <LongTermItem
            icon={<Award size={14} color="#C8D0DD" />}
            label="שתי הפיינליסטיות נכון"
            pts="100"
            sublabel="50 לכל פיינליסטית"
            highlight
          />
          <LongTermItem
            icon={<Award size={14} color="#8A93A6" />}
            label="פיינליסטית אחת בלבד"
            pts="40"
            small
          />

          <MiniDivider />
          <SubHeader>חצי-גמרניות (לנחש את 4 הקבוצות)</SubHeader>
          <LongTermItem
            icon={<Star size={14} color="#9BBAEA" />}
            label="לכל קבוצה שעולה לחצי גמר"
            pts="20"
            sublabel="עד 80 נק׳ אם 4/4"
          />
          <LongTermItem
            icon={<Sparkles size={14} color="#FFD93D" />}
            label="בונוס: כל 4 נכון"
            pts="+20"
            sublabel="סה״כ 100 נק׳"
            highlight
            small
          />

          <MiniDivider />
          <SubHeader>פרסים אישיים</SubHeader>
          <LongTermItem
            icon={<Goal size={14} color="#06A77D" />}
            label="מלך שערים (Golden Boot)"
            pts="70"
          />
          <LongTermItem
            icon={<Goal size={14} color="#06A77D" />}
            label="מלך בישולים"
            pts="70"
          />
          <LongTermItem
            icon={<Star size={14} color="#FFD93D" />}
            label="כדור הזהב (שחקן הטורניר)"
            pts="70"
          />

          <div
            className="mt-2 rounded-xl p-3"
            style={{
              background: "rgba(255,217,61,0.06)",
              border: "1px solid rgba(255,217,61,0.20)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white">סה״כ מקסימום מצטיינים</span>
              <span className="num text-[18px] font-extrabold text-[#FFD93D]">510</span>
            </div>
            <p className="num mt-1.5 text-[10px] text-[color:var(--color-muted)]">
              100 (אלופה) + 100 (פיינליסטיות) + 100 (חצי-גמרניות) + 210 (פרסים) = 510
            </p>
          </div>
        </BigSection>

        {/* ============================================ */}
        {/*   DOUBLE DOWN                                */}
        {/* ============================================ */}
        <BigSection
          color="#06A77D"
          icon={<Zap size={18} color="#06A77D" />}
          title="Double Down"
          subtitle="ז'יטוני הכפלה — 8 הזדמנויות לזכות בכפול"
        >
          <p className="text-[12.5px] leading-relaxed text-white">
            יש לך <strong className="text-[#06A77D]">8 ז'יטונים</strong> — אחד לכל מחזור/שלב.
            הניקוד של המשחק שתבחר יוכפל ב-<span className="num font-extrabold text-[#06A77D]">×2</span>{" "}
            (כולל בונוסים).
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <DDTag label="מחזור בתים 1" />
            <DDTag label="מחזור בתים 2" />
            <DDTag label="מחזור בתים 3" />
            <DDTag label="סבב 32" />
            <DDTag label="שמינית גמר" />
            <DDTag label="רבע גמר" />
            <DDTag label="חצי גמר" />
            <DDTag label="גמר / מקומות 3-4" />
          </div>

          <Tip>
            הז'יטון של "גמר" תקף גם לגמר וגם למקומות 3-4 — אבל רק לאחד מהם (בחירה שלך).
            אחרי שהמשחק שעליו הפעלת DD נעול, לא ניתן להזיז.
          </Tip>
        </BigSection>

        {/* ============================================ */}
        {/*   LOCK RULES                                 */}
        {/* ============================================ */}
        <BigSection
          color="#FF7A85"
          icon={<Lock size={18} color="#FF7A85" />}
          title="מתי הניחושים נעולים?"
          subtitle="מה אפשר ומה אסור לשנות"
        >
          <LockRule
            icon={<Clock size={14} color="#FFD93D" />}
            title="ניחוש משחק בודד"
            body="נעול 30 דקות לפני שריקת הפתיחה. עד אז — תוכל לשנות כמה שתרצה."
          />
          <LockRule
            icon={<Clock size={14} color="#FFD93D" />}
            title="טבלאות בתים + מצטיינים"
            body="נעולים שעה לפני המשחק הראשון של הטורניר (11.6.2026). אחרי זה — סופי."
          />
          <LockRule
            icon={<Lock size={14} color="#FF7A85" />}
            title="הצטרפות למשחק"
            body="ניתן להצטרף עם קוד הזמנה רק לפני תחילת המונדיאל. אחרי שזה מתחיל — המשחק נסגר."
          />
          <LockRule
            icon={<Zap size={14} color="#06A77D" />}
            title="הפעלת Double Down"
            body="חייב להפעיל לפני שהמשחק נעול (30 דק׳ לפני kickoff)."
          />
        </BigSection>

        {/* ============================================ */}
        {/*   MAX BREAKDOWN                              */}
        {/* ============================================ */}
        <BigSection
          color="#C8D0DD"
          icon={<Calculator size={18} color="#C8D0DD" />}
          title="חלוקת הניקוד המקסימלי"
          subtitle="איפה אפשר לצבור הכי הרבה"
        >
          <TotalRow label="משחקי בתים" sub="72 משחקים" pts={432} />
          <TotalRow label="טבלאות בתים" sub="12 בתים" pts={360} />
          <TotalRow label="סבב 32" sub="16 משחקים" pts={240} />
          <TotalRow label="שמינית גמר" sub="8 משחקים" pts={184} />
          <TotalRow label="רבע גמר" sub="4 משחקים" pts={140} />
          <TotalRow label="חצי גמר" sub="2 משחקים" pts={100} />
          <TotalRow label="מקומות 3-4" sub="1 משחק" pts={50} />
          <TotalRow label="הגמר" sub="1 משחק" pts={100} highlight />
          <TotalRow label="מצטיינים" sub="ניחושי טווח-ארוך" pts={510} />
          <div className="mt-2 h-px bg-white/10" />
          <div className="mt-2 flex items-end justify-between">
            <span className="text-[14px] font-extrabold text-white">סה״כ מקסימום</span>
            <span
              className="num text-[24px] font-black"
              style={{ color: "#FFD93D", textShadow: "0 0 20px rgba(255,217,61,0.35)" }}
            >
              2,116
            </span>
          </div>
          <p className="mt-1 text-end text-[10px] text-[color:var(--color-muted)]">
            + עד ~240 נק׳ נוספות מבונוסי Double Down
          </p>
        </BigSection>

        {/* small footer */}
        <p className="text-center text-[10px] text-[color:var(--color-muted)] py-2">
          שאלות? בעיות? פנה לבעל המשחק 🏆
        </p>
      </main>
      </div>
    </div>
  );
}

// ============================================================
// UI helpers
// ============================================================

/** Big section card — wrapper לכל קטגוריה ראשית. */
function BigSection({
  color, icon, title, subtitle, children,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl p-4"
      style={{
        background: "rgba(20, 27, 45, 0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${color}25`,
        boxShadow: `0 8px 24px -12px ${color}30`,
      }}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `${color}15`, border: `1px solid ${color}40` }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold text-white">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </motion.section>
  );
}

function ScoreRow({
  points, label, note, highlight, small,
}: {
  points: string;
  label: string;
  note?: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={{
        background: highlight ? "rgba(255,217,61,0.08)" : "rgba(255,255,255,0.02)",
        border: highlight ? "1px solid rgba(255,217,61,0.25)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className={`font-bold text-white ${small ? "text-[11.5px]" : "text-[12.5px]"}`}>{label}</p>
        {note && <p className="mt-0.5 text-[10px] text-[color:var(--color-muted)]">{note}</p>}
      </div>
      <div
        className="num shrink-0 text-end"
        style={{
          color: highlight ? "#FFD93D" : "#F4F6FB",
          fontWeight: 800,
          fontSize: small ? 15 : 18,
        }}
      >
        {points}
      </div>
    </div>
  );
}

function LongTermItem({
  icon, label, pts, sublabel, highlight, small,
}: {
  icon: React.ReactNode;
  label: string;
  pts: string;
  sublabel?: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={{
        background: highlight ? "rgba(255,217,61,0.08)" : "rgba(255,255,255,0.02)",
        border: highlight ? "1px solid rgba(255,217,61,0.25)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={`font-bold text-white ${small ? "text-[11.5px]" : "text-[12.5px]"}`}>{label}</p>
        {sublabel && (
          <p className="mt-0.5 text-[10px] text-[color:var(--color-muted)]">{sublabel}</p>
        )}
      </div>
      <div
        className="num shrink-0 text-end"
        style={{
          color: highlight ? "#FFD93D" : "#F4F6FB",
          fontWeight: 800,
          fontSize: small ? 14 : 17,
        }}
      >
        +{pts}
      </div>
    </div>
  );
}

function KnockoutStageRow({
  stage, winner, exact, max, highlight,
}: {
  stage: string;
  winner: number;
  exact: number;
  max: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(255,217,61,0.12), rgba(255,170,0,0.05))"
          : "rgba(255,255,255,0.02)",
        border: highlight ? "1px solid rgba(255,217,61,0.40)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className={`font-bold text-white ${highlight ? "text-[13px]" : "text-[12.5px]"}`}>{stage}</p>
        <span
          className="num text-[15px] font-extrabold"
          style={{ color: highlight ? "#FFD93D" : "#F4F6FB" }}
        >
          {max}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2.5 text-[10.5px] text-[color:var(--color-muted)]">
        <span>
          כיוון: <span className="num font-bold text-white">{winner}</span>
        </span>
        <span className="text-white/20">·</span>
        <span>
          + מדויק: <span className="num font-bold text-white">{exact}</span>
        </span>
      </div>
    </div>
  );
}

function LockRule({
  icon, title, body,
}: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl p-2.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-white">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-[color:var(--color-muted)]">{body}</p>
      </div>
    </div>
  );
}

function ExampleCard({
  icon, tone, scenario, example, result,
}: {
  icon: React.ReactNode;
  tone: "blue" | "green" | "gold";
  scenario: string;
  example: string;
  result: string;
}) {
  const colors = {
    blue: { bg: "rgba(155,186,234,0.08)", border: "rgba(155,186,234,0.30)", accent: "#9BBAEA" },
    green: { bg: "rgba(6,167,125,0.08)", border: "rgba(6,167,125,0.30)", accent: "#06A77D" },
    gold: { bg: "rgba(255,217,61,0.08)", border: "rgba(255,217,61,0.32)", accent: "#FFD93D" },
  }[tone];

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: `${colors.accent}15`, border: `1px solid ${colors.accent}40` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-white">{scenario}</p>
        <p className="num mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">{example}</p>
      </div>
      <span
        className="num shrink-0 text-[16px] font-extrabold"
        style={{ color: colors.accent }}
      >
        {result}
      </span>
    </div>
  );
}

function DDTag({ label }: { label: string }) {
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center text-[10.5px] font-bold text-white"
      style={{
        background: "rgba(6,167,125,0.10)",
        border: "1px solid rgba(6,167,125,0.30)",
      }}
    >
      {label}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-2 rounded-xl p-3 text-[11px] leading-relaxed text-[color:var(--color-muted)]"
      style={{
        background: "rgba(155,186,234,0.05)",
        border: "1px solid rgba(155,186,234,0.15)",
      }}
    >
      💡 {children}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--color-muted)]">
      {children}
    </p>
  );
}

function MiniDivider() {
  return <div className="my-2 h-px bg-white/5" />;
}

function MaxCard({ label, pts }: { label: string; pts: string }) {
  return (
    <div
      className="mt-2 flex items-center justify-between rounded-xl px-3 py-2"
      style={{
        background: "rgba(255,217,61,0.06)",
        border: "1px solid rgba(255,217,61,0.20)",
      }}
    >
      <span className="text-[11.5px] font-bold text-white">{label}</span>
      <span className="num text-[14px] font-extrabold text-[#FFD93D]">{pts}</span>
    </div>
  );
}

function TotalRow({
  label, sub, pts, highlight,
}: { label: string; sub?: string; pts: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p
          className={`font-bold ${highlight ? "text-[13px] text-[#FFD93D]" : "text-[12px] text-white"}`}
        >
          {label}
        </p>
        {sub && (
          <p className="mt-0.5 text-[9.5px] text-[color:var(--color-muted)]">{sub}</p>
        )}
      </div>
      <span
        className="num text-[14px] font-extrabold"
        style={{ color: highlight ? "#FFD93D" : "#F4F6FB" }}
      >
        {pts.toLocaleString()}
      </span>
    </div>
  );
}
