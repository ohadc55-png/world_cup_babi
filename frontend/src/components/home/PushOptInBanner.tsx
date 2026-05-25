// באנר התראות עם 2 מצבים:
//   - "default" / "needs-resubscribe" → הצעה להפעיל ("אפשר")
//   - "subscribed" → מצב פעיל עם כפתור "שלח בדיקה"
//
// בכל אחד מהמצבים אפשר לסגור עם X — נדחה ל-7 ימים (default) או 30 ימים (subscribed).

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRing, X, Send, Check } from "lucide-react";
import { usePush } from "@/hooks/usePush";
import { sendTestPush } from "@/lib/push";

const DISMISS_PROMPT_KEY = "mundial2026_push_banner_dismissed";
const DISMISS_TEST_KEY = "mundial2026_push_test_dismissed";
const DISMISS_PROMPT_DAYS = 7;
const DISMISS_TEST_DAYS = 30;

function isDismissed(key: string, days: number): boolean {
  const ts = localStorage.getItem(key);
  if (!ts) return false;
  const ago = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
  return ago < days;
}

function markDismissed(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

export function PushOptInBanner() {
  const { state, busy, enable } = usePush();
  const [promptDismissed, setPromptDismissed] = useState(() =>
    isDismissed(DISMISS_PROMPT_KEY, DISMISS_PROMPT_DAYS),
  );
  const [testDismissed, setTestDismissed] = useState(() =>
    isDismissed(DISMISS_TEST_KEY, DISMISS_TEST_DAYS),
  );

  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  // קובע מה להציג לפי המצב
  const showPrompt =
    !promptDismissed && (state === "default" || state === "needs-resubscribe");
  const showSubscribed = !testDismissed && state === "subscribed";

  if (!showPrompt && !showSubscribed) return null;

  async function handleSendTest() {
    setTestStatus("sending");
    setTestError(null);
    try {
      const r = await sendTestPush();
      if (r.sent > 0) {
        setTestStatus("sent");
        setTimeout(() => setTestStatus("idle"), 4000);
      } else {
        setTestStatus("error");
        setTestError("נכשל - נסה שוב");
      }
    } catch (e) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : "שגיאת רשת");
    }
  }

  // ====== מצב 1: הצעה להפעיל ======
  if (showPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl p-3.5"
          style={{
            background:
              "linear-gradient(135deg, rgba(29,53,87,0.30) 0%, rgba(20,27,45,0.50) 100%)",
            border: "1.5px solid rgba(155,186,234,0.28)",
            boxShadow: "0 8px 24px -8px rgba(29,53,87,0.40)",
          }}
        >
          <button
            onClick={() => {
              markDismissed(DISMISS_PROMPT_KEY);
              setPromptDismissed(true);
            }}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
            aria-label="סגור"
          >
            <X size={12} color="#8A93A6" />
          </button>

          <div className="flex items-center gap-3 pe-7">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: "rgba(155,186,234,0.18)",
                border: "1px solid rgba(155,186,234,0.40)",
              }}
            >
              <Bell size={17} color="#9BBAEA" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">קבל התראות חשובות</p>
              <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
                משחקים מתחילים, תוצאות, שינויי דירוג
              </p>
            </div>
            <button
              onClick={enable}
              disabled={busy}
              className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #1D3557, #14182a)",
                border: "1px solid rgba(155,186,234,0.40)",
              }}
            >
              {busy ? "..." : "אפשר"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ====== מצב 2: מנוי פעיל + כפתור בדיקה ======
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl p-3.5"
        style={{
          background:
            "linear-gradient(135deg, rgba(6,167,125,0.10) 0%, rgba(6,167,125,0.04) 100%)",
          border: "1.5px solid rgba(6,167,125,0.30)",
          boxShadow: "0 8px 24px -8px rgba(6,167,125,0.30)",
        }}
      >
        <button
          onClick={() => {
            markDismissed(DISMISS_TEST_KEY);
            setTestDismissed(true);
          }}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
          aria-label="סגור"
        >
          <X size={12} color="#8A93A6" />
        </button>

        <div className="flex items-center gap-3 pe-7">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{
              background: "rgba(6,167,125,0.18)",
              border: "1px solid rgba(6,167,125,0.45)",
            }}
          >
            <BellRing size={17} color="#06A77D" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">התראות פעילות ✓</p>
            <p className="mt-0.5 text-[10.5px] text-[color:var(--color-muted)]">
              {testStatus === "sent"
                ? "התראת בדיקה נשלחה - בדוק את המסך"
                : testStatus === "error"
                ? testError ?? "שגיאה"
                : "לחץ לבדוק שזה עובד"}
            </p>
          </div>
          <button
            onClick={handleSendTest}
            disabled={testStatus === "sending"}
            className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold text-white transition-all disabled:opacity-50"
            style={{
              background:
                testStatus === "sent"
                  ? "linear-gradient(135deg, #06A77D, #048662)"
                  : "linear-gradient(135deg, #1D3557, #14182a)",
              border: "1px solid rgba(6,167,125,0.45)",
            }}
          >
            {testStatus === "sending" ? (
              "שולח..."
            ) : testStatus === "sent" ? (
              <span className="inline-flex items-center gap-1">
                <Check size={12} />
                <span>נשלח</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Send size={12} />
                <span>בדוק</span>
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
