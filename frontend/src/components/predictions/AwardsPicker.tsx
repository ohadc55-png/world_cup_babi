// טאב "מצטיינים" — ניחושי טווח-ארוך:
//   - אלופת המונדיאל (80 נק')
//   - 2 פיינליסטיות (40 נק' אם שניהם נכון, 15 לפיינליסטית אחת)
//   - 4 חצי-גמרניות (בונוס 30 נק' אם כל 4 נכון)
//   - מלך שערים, מלך בישולים, כדור הזהב (70/70/30 נק')

import { useEffect, useMemo, useState } from "react";
import { Trophy, Star, Goal, Award, Save, Lock } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { getTeamInfo } from "@/lib/teams";
import { useMyTournamentPredictions } from "@/hooks/usePredictions";
import { useMyGame } from "@/hooks/useGame";
import { useAllTeams } from "@/hooks/useTeams";
import type { TournamentPredictions } from "@/types";
import { TeamPickerSheet } from "./TeamPickerSheet";

// שדות שמכילים שמות קבוצות
type TeamField = "winner" | "finalist_1" | "finalist_2" | "semifinalist_1" | "semifinalist_2" | "semifinalist_3" | "semifinalist_4";
// שדות שמכילים שמות שחקנים
type PlayerField = "top_scorer" | "top_assister" | "golden_ball";

export function AwardsPicker() {
  const { data: teamsData, loading: teamsLoading } = useAllTeams();
  const { data: existing, loading: predLoading, setLocal } = useMyTournamentPredictions();
  const { data: myGame } = useMyGame();
  const tournamentStarted = !!myGame?.tournament_has_started;

  // state מקומי לעריכת השדות
  const [form, setForm] = useState<Partial<TournamentPredictions>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // bottom sheet לבחירת קבוצה — מאיזה שדה נפתח
  const [pickerField, setPickerField] = useState<TeamField | null>(null);

  // אתחול הטופס מהקיים
  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  function setTeam(field: TeamField, value: string) {
    if (tournamentStarted) return;
    setForm((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }
  function setPlayer(field: PlayerField, value: string) {
    if (tournamentStarted) return;
    setForm((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }
  function openPicker(field: TeamField) {
    if (tournamentStarted) return;
    setPickerField(field);
  }

  // רשימת קבוצות שכבר נבחרו ב-finalists/semis (כדי למנוע כפילויות)
  const finalistsSelected = useMemo(() => {
    return [form.finalist_1, form.finalist_2].filter(Boolean) as string[];
  }, [form.finalist_1, form.finalist_2]);

  const semisSelected = useMemo(() => {
    return [
      form.semifinalist_1,
      form.semifinalist_2,
      form.semifinalist_3,
      form.semifinalist_4,
    ].filter(Boolean) as string[];
  }, [form.semifinalist_1, form.semifinalist_2, form.semifinalist_3, form.semifinalist_4]);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<TournamentPredictions>("/api/predictions/tournament", {
        method: "PUT",
        body: form,
      });
      setLocal(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      if (e instanceof ApiException) {
        const detail =
          typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)
            ? (e.detail as { detail: string }).detail
            : "שגיאה";
        setError(typeof detail === "string" ? detail : "שגיאה");
      } else {
        setError("שגיאת רשת");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (teamsLoading || predLoading) {
    return <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">טוען...</p>;
  }
  if (!teamsData) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--color-error)" }}>
        שגיאה בטעינת קבוצות
      </p>
    );
  }

  return (
    <>
      {tournamentStarted && (
        <div
          className="mb-3 flex items-center gap-3 rounded-2xl p-3.5"
          style={{
            background: "linear-gradient(135deg, rgba(255,122,133,0.08), rgba(230,57,70,0.04))",
            border: "1.5px solid rgba(230,57,70,0.32)",
          }}
        >
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{
              background: "rgba(230,57,70,0.15)",
              border: "1px solid rgba(230,57,70,0.40)",
            }}
          >
            <Lock size={18} color="#FF7A85" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-white">ניחושי המצטיינים נעולים</p>
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
              המונדיאל התחיל - לא ניתן לשנות יותר. הניחושים שלך נשמרים לחישוב הסופי.
            </p>
          </div>
        </div>
      )}

      <div className="mb-3 px-1">
        <p className="text-[12px] text-[color:var(--color-muted)]">
          ניחושי טווח-ארוך — חייבים להישמר לפני תחילת המונדיאל. נעולים שעה לפני המשחק הראשון.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* === אלופת המונדיאל === */}
        <Section title="אלופת המונדיאל" subtitle="80 נק'" icon={<Trophy size={18} color="#FFD93D" />}>
          <TeamSlot
            label="אלופה"
            value={form.winner ?? null}
            onPick={() => openPicker("winner")}
          />
        </Section>

        {/* === פיינליסטיות === */}
        <Section
          title="פיינליסטיות"
          subtitle="40 נק' אם שניהן נכון · 15 אם אחת"
          icon={<Award size={18} color="#C8D0DD" />}
        >
          <div className="grid grid-cols-2 gap-2">
            <TeamSlot
              label="פיינליסטית 1"
              value={form.finalist_1 ?? null}
              onPick={() => openPicker("finalist_1")}
            />
            <TeamSlot
              label="פיינליסטית 2"
              value={form.finalist_2 ?? null}
              onPick={() => openPicker("finalist_2")}
            />
          </div>
        </Section>

        {/* === חצי-גמרניות === */}
        <Section
          title="חצי-גמרניות"
          subtitle="בונוס 30 נק' אם כל 4 נכון"
          icon={<Star size={18} color="#9BBAEA" />}
        >
          <div className="grid grid-cols-2 gap-2">
            <TeamSlot
              label="קבוצה 1"
              value={form.semifinalist_1 ?? null}
              onPick={() => openPicker("semifinalist_1")}
            />
            <TeamSlot
              label="קבוצה 2"
              value={form.semifinalist_2 ?? null}
              onPick={() => openPicker("semifinalist_2")}
            />
            <TeamSlot
              label="קבוצה 3"
              value={form.semifinalist_3 ?? null}
              onPick={() => openPicker("semifinalist_3")}
            />
            <TeamSlot
              label="קבוצה 4"
              value={form.semifinalist_4 ?? null}
              onPick={() => openPicker("semifinalist_4")}
            />
          </div>
        </Section>

        {/* === מצטיינים אישיים === */}
        <Section
          title="מצטיינים אישיים"
          subtitle="70 נק' לכל אחד"
          icon={<Goal size={18} color="#06A77D" />}
        >
          <div className="flex flex-col gap-2.5">
            <PlayerInput
              label="מלך שערים (Golden Boot)"
              value={form.top_scorer ?? ""}
              onChange={(v) => setPlayer("top_scorer", v)}
              placeholder="שם השחקן"
            />
            <PlayerInput
              label="מלך בישולים"
              value={form.top_assister ?? ""}
              onChange={(v) => setPlayer("top_assister", v)}
              placeholder="שם השחקן"
            />
            <PlayerInput
              label="כדור הזהב (שחקן הטורניר)"
              value={form.golden_ball ?? ""}
              onChange={(v) => setPlayer("golden_ball", v)}
              placeholder="שם השחקן"
            />
          </div>
        </Section>

        {/* === Submit === */}
        {error && (
          <p className="text-center text-sm font-medium" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}
        {saved && (
          <p className="text-center text-sm font-medium" style={{ color: "#06A77D" }}>
            ✓ נשמר
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={submitting || tournamentStarted}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-extrabold text-white transition-all disabled:opacity-40"
          style={{
            background: tournamentStarted
              ? "linear-gradient(135deg, #3F465A, #2A3142)"
              : "linear-gradient(135deg, #E63946, #B12E3D)",
            boxShadow: tournamentStarted
              ? undefined
              : "0 12px 32px -10px rgba(230,57,70,0.6)",
          }}
        >
          {tournamentStarted ? <Lock size={16} /> : <Save size={18} />}
          {tournamentStarted ? "נעול" : submitting ? "שומר..." : "שמור ניחושים"}
        </button>
      </div>

      {/* TeamPicker שיתופי — נפתח לפי pickerField */}
      <TeamPickerSheet
        title={pickerField ? titleForField(pickerField) : null}
        teams={teamsData.allTeams}
        selected={pickerField ? (form[pickerField] as string) ?? null : null}
        disabled={
          pickerField === "finalist_1" || pickerField === "finalist_2"
            ? finalistsSelected
            : pickerField?.startsWith("semifinalist")
            ? semisSelected
            : []
        }
        onSelect={(team) => pickerField && setTeam(pickerField, team)}
        onClose={() => setPickerField(null)}
      />
    </>
  );
}

// ============================================
// Helpers
// ============================================

function titleForField(field: TeamField): string {
  const map: Record<TeamField, string> = {
    winner: "בחר אלופה",
    finalist_1: "בחר פיינליסטית 1",
    finalist_2: "בחר פיינליסטית 2",
    semifinalist_1: "בחר חצי-גמרנית 1",
    semifinalist_2: "בחר חצי-גמרנית 2",
    semifinalist_3: "בחר חצי-גמרנית 3",
    semifinalist_4: "בחר חצי-גמרנית 4",
  };
  return map[field];
}

// ============================================
// Section wrapper (frosted card)
// ============================================

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: "rgba(20, 27, 45, 0.32)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 8px 24px -12px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-[14px] font-bold text-white">{title}</h3>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

// ============================================
// TeamSlot — pill לבחירת קבוצה
// ============================================

function TeamSlot({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string | null;
  onPick: () => void;
}) {
  const info = value ? getTeamInfo(value) : null;
  return (
    <button
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 no-tap transition-all hover:bg-white/5"
      style={{
        background: value ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${value ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {info ? (
        <>
          <span className="text-xl">{info.flag}</span>
          <span className="flex-1 text-end text-[13px] font-bold text-white truncate">
            {info.he}
          </span>
        </>
      ) : (
        <span className="flex-1 text-end text-[12px] text-[color:var(--color-muted)]">
          {label} ← לחץ לבחירה
        </span>
      )}
    </button>
  );
}

// ============================================
// PlayerInput — input טקסט לשם שחקן
// ============================================

function PlayerInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold text-[color:var(--color-muted)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-[13px] font-medium text-white placeholder:text-white/30 outline-none focus:bg-white/8"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}
