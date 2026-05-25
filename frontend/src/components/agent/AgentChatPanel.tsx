// פאנל צ'אט הסוכן — נשלף מהצד עם slide-in animation.
//
// UX:
// - Desktop (>=640px): פאנל ברוחב 380px נצמד לקצה (visual right ב-RTL = left in LTR terms)
// - Mobile: full-width
// - הודעות משתמש בצד אחד, של הסוכן בצד שני
// - אינדיקטור "typing" בזמן ש-Claude מעבד
// - 4 starter suggestions מופיעים רק כשאין הודעות עדיין
// - reset button במסגרת אישור

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Send, RotateCcw } from "lucide-react";
import { useAgent } from "@/hooks/useAgent";

type Props = {
  onClose: () => void;
};

export function AgentChatPanel({ onClose }: Props) {
  const { messages, welcome, suggestions, isLoading, isInitializing, send, reset } =
    useAgent(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // גלילה אוטומטית לתחתית בכל שינוי בהודעות / loading
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  async function handleSend(messageOverride?: string) {
    const text = (messageOverride ?? input).trim();
    if (!text || isLoading) return;
    setInput("");
    await send(text);
  }

  async function handleReset() {
    if (!confirm("לאפס את כל השיחה עם הסוכן?")) return;
    await reset();
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        key="agent-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] no-tap"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      />

      {/* Panel — נשלף מהקצה הוויזואלי הימני (אותו צד כמו הכפתור) */}
      <motion.div
        key="agent-panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className="fixed top-0 bottom-0 z-[101] flex flex-col"
        style={{
          right: 0,  // visual right edge — אותו צד כמו הכפתור הצף
          width: "min(100vw, 380px)",
          background: "var(--color-bg)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 60px -10px rgba(0,0,0,0.7)",
        }}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 py-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,179,71,0.18), rgba(255,217,61,0.06))",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "max(12px, env(safe-area-inset-top))",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full overflow-hidden"
              style={{ boxShadow: "0 0 0 1.5px rgba(255,217,61,0.55)" }}
            >
              <img
                src="/img/pelican.jpg"
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <p className="text-[13px] font-extrabold text-white leading-tight truncate">
              השקנאי הרשמי של באבי גרופ מונדיאל
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/8"
              aria-label="אפס שיחה"
              title="אפס שיחה"
            >
              <RotateCcw size={16} color="#C8D0DD" />
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/8"
              aria-label="סגור"
            >
              <X size={18} color="#F4F6FB" />
            </button>
          </div>
        </header>

        {/* Messages list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {isInitializing && (
            <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
              טוען שיחה...
            </p>
          )}

          {!isInitializing && welcome && messages.length === 0 && (
            <div
              className="rounded-2xl p-3.5 text-[13px] text-white whitespace-pre-line"
              style={{
                background: "rgba(20,27,45,0.55)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {welcome}
            </div>
          )}

          {!isInitializing && suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="px-1 text-[10px] text-[color:var(--color-muted)]">
                שאלות נפוצות:
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full rounded-xl px-3 py-2.5 text-end text-[12.5px] font-medium text-white no-tap transition-colors"
                  style={{
                    background: "rgba(20,27,45,0.55)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2.5">
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && <TypingIndicator />}
          </div>
        </div>

        {/* Input */}
        <div
          className="border-t px-3 py-3"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(10,14,26,0.65)",
            backdropFilter: "blur(14px)",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="שאל אותי משהו..."
              disabled={isLoading}
              maxLength={1000}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder:text-[color:var(--color-muted)] outline-none disabled:opacity-50"
              style={{
                background: "rgba(20,27,45,0.65)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label="שלח"
              className="grid h-10 w-10 place-items-center rounded-xl no-tap disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #FFB347, #FFD93D)",
              }}
            >
              <Send size={16} color="#1A1300" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}

// ============================================================
// Sub-components
// ============================================================

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-line"
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, rgba(91,158,255,0.20), rgba(91,158,255,0.10))",
                border: "1px solid rgba(91,158,255,0.30)",
                color: "#F4F6FB",
              }
            : {
                background: "rgba(20,27,45,0.55)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#F4F6FB",
              }
        }
      >
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl px-3.5 py-3"
        style={{
          background: "rgba(20,27,45,0.55)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay }}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: "#9BBAEA" }}
          />
        ))}
      </div>
    </div>
  );
}
