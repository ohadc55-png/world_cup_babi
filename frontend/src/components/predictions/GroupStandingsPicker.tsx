// טאב "בתים" — מציג 12 כרטיסי בתים. לחיצה על בית פותחת editor sheet בו המשתמש
// מסדר את 4 הקבוצות לפי המיקום הצפוי בסוף שלב הבתים.
//
// UX: במקום drag-and-drop (שיכול להיות בעייתי במובייל), כל קבוצה יש חצים ↑↓
// להזזה במיקום. פשוט, אמין, נגיש.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Edit3, X, Check, Lock } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { getTeamInfo } from "@/lib/teams";
import { useMyGroupPredictions } from "@/hooks/usePredictions";
import { useMyGame } from "@/hooks/useGame";
import { useAllTeams } from "@/hooks/useTeams";
import type { GroupPrediction } from "@/types";

// תוויות מיקום בעברית + צבע מדליה
const POSITIONS: { idx: number; label: string; color: string; emoji: string }[] = [
  { idx: 0, label: "מקום 1", color: "#FFD93D", emoji: "🥇" },
  { idx: 1, label: "מקום 2", color: "#C8D0DD", emoji: "🥈" },
  { idx: 2, label: "מקום 3", color: "#CD7F32", emoji: "🥉" },
  { idx: 3, label: "מקום 4", color: "#8A93A6", emoji: "4" },
];

export function GroupStandingsPicker() {
  const { data: teamsData, loading: teamsLoading } = useAllTeams();
  const { byGroup, loading: predLoading, setLocal } = useMyGroupPredictions();
  const { data: myGame } = useMyGame();
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const tournamentStarted = !!myGame?.tournament_has_started;

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

  const groupNames = Object.keys(teamsData.teamsByGroup).sort();

  return (
    <>
      {/* Lock banner — מוצג אם המונדיאל כבר התחיל */}
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
            <p className="text-[12.5px] font-bold text-white">ניחושי הבתים נעולים</p>
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
              המונדיאל התחיל - לא ניתן לשנות יותר. הניחושים שלך נשמרים לחישוב הסופי.
            </p>
          </div>
        </div>
      )}

      <div className="mb-3 px-1">
        <p className="text-[12px] text-[color:var(--color-muted)]">
          לחץ על בית כדי לסדר את 4 הקבוצות לפי המיקום הצפוי בסוף שלב הבתים.
        </p>
        <p className="mt-1 text-[10.5px] text-[color:var(--color-muted)]">
          <span className="font-bold text-white">5 נק׳</span> לכל מיקום נכון
          <span className="mx-1">·</span>
          <span className="font-bold text-white">+10 בונוס</span> אם כל 4 נכונים
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {groupNames.map((g) => (
          <GroupCard
            key={g}
            groupName={g}
            prediction={byGroup[g] ?? null}
            tournamentStarted={tournamentStarted}
            onEdit={() => setEditingGroup(g)}
          />
        ))}
      </div>

      {editingGroup && (
        <GroupEditorSheet
          groupName={editingGroup}
          teams={teamsData.teamsByGroup[editingGroup] ?? []}
          existing={byGroup[editingGroup] ?? null}
          onClose={() => setEditingGroup(null)}
          onSaved={(p) => {
            setLocal(p);
            setEditingGroup(null);
          }}
        />
      )}
    </>
  );
}

// ====================================================
// GroupCard — שורה בודדת ברשימה
// ====================================================

function GroupCard({
  groupName,
  prediction,
  onEdit,
  tournamentStarted = false,
}: {
  groupName: string;
  prediction: GroupPrediction | null;
  onEdit: () => void;
  tournamentStarted?: boolean;
}) {
  const isLocked = !!prediction?.locked_at || tournamentStarted;
  const hasPred = prediction !== null;

  return (
    <button
      onClick={onEdit}
      disabled={isLocked}
      className="relative w-full overflow-hidden text-end no-tap transition-all hover:scale-[1.005] disabled:opacity-60"
      style={{
        background: "rgba(20, 27, 45, 0.32)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: `1px solid ${hasPred ? "rgba(6, 167, 125, 0.32)" : "rgba(255, 255, 255, 0.12)"}`,
        borderRadius: 18,
        padding: "12px 14px",
        boxShadow: "0 8px 24px -12px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* group letter (right) */}
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-white"
          style={{
            background: hasPred
              ? "linear-gradient(135deg, #06A77D, #0E7A5C)"
              : "linear-gradient(135deg, #1D3557, #14253E)",
            boxShadow: hasPred ? "0 4px 12px -4px rgba(6,167,125,0.5)" : undefined,
          }}
        >
          {groupName}
        </div>

        {/* main label + flags row */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white leading-tight">בית {groupName}</p>
          {hasPred ? (
            <div className="mt-1 flex items-center gap-1.5 text-[13px]">
              <span>{getTeamInfo(prediction.team_1st).flag}</span>
              <span className="text-white/60">→</span>
              <span>{getTeamInfo(prediction.team_2nd).flag}</span>
              <span className="text-white/60">→</span>
              <span>{getTeamInfo(prediction.team_3rd).flag}</span>
              <span className="text-white/60">→</span>
              <span>{getTeamInfo(prediction.team_4th).flag}</span>
            </div>
          ) : (
            <p className="mt-0.5 text-[11px] text-[color:var(--color-muted)]">לא נוחש עדיין</p>
          )}
        </div>

        {/* status */}
        <div className="shrink-0">
          {hasPred ? (
            <Check size={18} color="#06A77D" strokeWidth={3} />
          ) : (
            <Edit3 size={16} color="#8A93A6" />
          )}
        </div>
      </div>
    </button>
  );
}

// ====================================================
// GroupEditorSheet — bottom sheet לסידור 4 הקבוצות
// ====================================================

function GroupEditorSheet({
  groupName,
  teams,
  existing,
  onClose,
  onSaved,
}: {
  groupName: string;
  teams: string[]; // 4 שמות באנגלית
  existing: GroupPrediction | null;
  onClose: () => void;
  onSaved: (p: GroupPrediction) => void;
}) {
  // state — סדר הקבוצות (ראשונה = מקום 1, אחרונה = מקום 4)
  const [order, setOrder] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // אתחול הסדר לפי הניחוש הקיים, או לפי הסדר המקורי
  useEffect(() => {
    if (existing) {
      setOrder([existing.team_1st, existing.team_2nd, existing.team_3rd, existing.team_4th]);
    } else {
      setOrder([...teams]);
    }
    setError(null);
  }, [existing, teams.join(",")]);

  function move(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx > 3) return;
    setOrder((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, item);
      return copy;
    });
  }

  async function handleSave() {
    if (order.length !== 4) {
      setError("חייב 4 קבוצות");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const saved = await api<GroupPrediction>(`/api/predictions/groups/${groupName}`, {
        method: "PUT",
        body: {
          team_1st: order[0],
          team_2nd: order[1],
          team_3rd: order[2],
          team_4th: order[3],
        },
      });
      onSaved(saved);
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

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-[100] no-tap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      />
      <motion.div
        key="sheet"
        className="fixed inset-x-0 bottom-0 z-[101] no-tap"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.7)",
          maxHeight: "90dvh",
          overflowY: "auto",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.20)" }} />
        </div>

        <button
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5"
          onClick={onClose}
          aria-label="סגור"
        >
          <X size={18} color="#F4F6FB" />
        </button>

        <div className="px-5 pt-6">
          <p className="eyebrow text-center">בית {groupName} · סדר את המיקומים</p>

          <div className="mt-5 flex flex-col gap-2">
            {order.map((teamEnglish, idx) => {
              const info = getTeamInfo(teamEnglish);
              const pos = POSITIONS[idx];
              return (
                <div
                  key={teamEnglish}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${pos.color}33`,
                  }}
                >
                  {/* position badge (right in RTL) */}
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold"
                    style={{
                      background: `${pos.color}22`,
                      color: pos.color,
                      border: `1px solid ${pos.color}55`,
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* team flag + name */}
                  <div className="flex flex-1 items-center gap-2.5 min-w-0">
                    <span className="text-2xl">{info.flag}</span>
                    <span className="text-[14px] font-bold text-white truncate">{info.he}</span>
                  </div>

                  {/* up/down arrows (left in RTL) */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(idx, idx - 1)}
                      disabled={idx === 0}
                      className="grid h-7 w-7 place-items-center rounded-md no-tap disabled:opacity-20"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      aria-label="העלה"
                    >
                      <ChevronUp size={14} color="#F4F6FB" />
                    </button>
                    <button
                      onClick={() => move(idx, idx + 1)}
                      disabled={idx === 3}
                      className="grid h-7 w-7 place-items-center rounded-md no-tap disabled:opacity-20"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      aria-label="הורד"
                    >
                      <ChevronDown size={14} color="#F4F6FB" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p
              className="mt-4 text-center text-sm font-medium"
              style={{ color: "var(--color-error)" }}
            >
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={submitting}
            className="mt-6 h-14 w-full rounded-2xl text-[16px] font-extrabold text-white transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #E63946, #B12E3D)",
              boxShadow: "0 12px 32px -10px rgba(230,57,70,0.6)",
            }}
          >
            {submitting ? "שומר..." : existing ? "עדכן ניחוש" : "שמור ניחוש"}
          </button>

          <p className="mt-3 text-center text-[10px] text-[color:var(--color-muted)]">
            5 נק׳ לכל מיקום נכון · +10 בונוס אם כל 4 נכונים
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
