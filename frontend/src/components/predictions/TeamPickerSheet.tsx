// Bottom sheet לבחירת קבוצה — מציג רשימה גלילה עם חיפוש.
// משמש את AwardsPicker (champion, finalists, semifinalists).

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Check } from "lucide-react";
import { getTeamInfo } from "@/lib/teams";

type Props = {
  // null = closed; string = open with title
  title: string | null;
  // רשימת השמות המלאה (באנגלית)
  teams: string[];
  // הקבוצה הנבחרת כרגע (אם יש) — מסומנת בצ'ק
  selected: string | null;
  // קבוצות שלא ניתן לבחור (כי כבר נבחרו במקום אחר) — disabled
  disabled?: string[];
  onSelect: (teamEnglishName: string) => void;
  onClose: () => void;
};

export function TeamPickerSheet({ title, teams, selected, disabled = [], onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

  // סינון לפי חיפוש (גם בעברית וגם באנגלית)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const info = getTeamInfo(t);
      return t.toLowerCase().includes(q) || info.he.includes(query.trim());
    });
  }, [teams, query]);

  const disabledSet = useMemo(() => new Set(disabled), [disabled]);

  if (!title) return null;

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
        className="fixed inset-x-0 bottom-0 z-[101] no-tap flex flex-col"
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
          maxHeight: "85dvh",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.20)" }} />
        </div>

        {/* close button */}
        <button
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5 z-10"
          onClick={onClose}
          aria-label="סגור"
        >
          <X size={18} color="#F4F6FB" />
        </button>

        {/* header */}
        <div className="shrink-0 px-5 pt-3 pb-3">
          <p className="eyebrow text-center">{title}</p>

          {/* search */}
          <div className="relative mt-4">
            <Search
              size={16}
              color="#8A93A6"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש מדינה..."
              autoFocus
              className="w-full rounded-2xl bg-white/5 py-3 pe-10 ps-4 text-[14px] font-medium text-white placeholder:text-white/30 outline-none focus:bg-white/8"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-hidden">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">
              לא נמצאה קבוצה
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((teamEnglish) => {
                const info = getTeamInfo(teamEnglish);
                const isSelected = teamEnglish === selected;
                const isDisabled = disabledSet.has(teamEnglish) && !isSelected;
                return (
                  <button
                    key={teamEnglish}
                    onClick={() => {
                      if (isDisabled) return;
                      onSelect(teamEnglish);
                      onClose();
                    }}
                    disabled={isDisabled}
                    className="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-end no-tap transition-all disabled:opacity-30"
                    style={{
                      background: isSelected ? "rgba(230,57,70,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${
                        isSelected ? "rgba(230,57,70,0.35)" : "rgba(255,255,255,0.06)"
                      }`,
                    }}
                  >
                    <span className="text-2xl">{info.flag}</span>
                    <span className="flex-1 text-[14px] font-bold text-white">{info.he}</span>
                    {isSelected && <Check size={18} color="#FF7A85" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
