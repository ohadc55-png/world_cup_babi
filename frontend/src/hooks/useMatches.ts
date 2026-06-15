// Hooks לשליפת משחקים מה-API
//
// משתמשים ב-useState + useEffect קלאסי (לא Tanstack Query עדיין — נשמור לימים אם נצטרך).
// כל hook מחזיר { data, loading, error } שזה הפורמט הסטנדרטי בקהילת React.
//
// Polling: useNextMatch + useMatchesToday מרעננים כל 30 שניות — אבל **רק** כשיש מה
// לרענן: משחק חי, או משחק מתוזמן שמתחיל בעוד עד 2 שעות / הסתיים לפני פחות מ-30 דקות.
// אחרת ה-interval כבוי לחלוטין. visibilitychange תמיד עושה fetch אחד כשחוזרים,
// כך שגם אם ה-interval כבוי, המשתמש מקבל עדכון טרי בכל חזרה ללשונית.

import { useEffect, useRef, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 30_000;
const PRE_KICKOFF_WINDOW_MIN = 120;   // לפתוח polling כבר 2 שעות לפני בעיטה
const POST_KICKOFF_GRACE_MIN = 30;    // להמשיך polling 30 דקות אחרי סיום (ESPN לפעמים מאחרת)

// משחק "שווה polling" אם הוא חי, או מתוזמן בחלון 2 שעות לפני / 30 דקות אחרי kickoff.
// אחרת לא צריך לבזבז בקשות רשת.
function isWorthPolling(match: Match | null): boolean {
  if (!match) return false;
  if (match.status === "live") return true;
  if (match.status === "scheduled" && match.kickoff_utc) {
    const ms = new Date(match.kickoff_utc).getTime() - Date.now();
    const minutesUntil = ms / 60_000;
    return minutesUntil <= PRE_KICKOFF_WINDOW_MIN && minutesUntil >= -POST_KICKOFF_GRACE_MIN;
  }
  return false;
}

// ====================================================
// useNextMatch — המשחק הבא (או LIVE אם יש כזה)
// ====================================================
export function useNextMatch(): HookResult<Match> {
  const [data, setData] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function stopTimer() {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function startTimerIfNeeded(latest: Match | null) {
      const should = isWorthPolling(latest);
      if (should && timerRef.current === null) {
        timerRef.current = window.setInterval(maybeRefresh, POLL_INTERVAL_MS);
      } else if (!should && timerRef.current !== null) {
        stopTimer();
      }
    }

    async function fetchOnce() {
      try {
        const match = await api<Match | null>("/api/matches/next");
        if (!cancelled) {
          setData(match);
          setError(null);
          startTimerIfNeeded(match);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function maybeRefresh() {
      if (!cancelled && document.visibilityState === "visible") fetchOnce();
    }

    fetchOnce();
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, []);

  return { data, loading, error };
}

// ====================================================
// useAllMatches — כל 104 המשחקים (לעמוד Bracket)
// ====================================================
export function useAllMatches(): HookResult<Match[]> {
  const [data, setData] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const matches = await api<Match[]>("/api/matches");
        if (!cancelled) setData(matches);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

// ====================================================
// useMatchesToday — משחקי היום (UTC), polling כל 30s רק אם יש משחק חי/קרוב
// ====================================================
export function useMatchesToday(): HookResult<Match[]> {
  const [data, setData] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function stopTimer() {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function startTimerIfNeeded(latest: Match[] | null) {
      const should = !!latest && latest.some(isWorthPolling);
      if (should && timerRef.current === null) {
        timerRef.current = window.setInterval(maybeRefresh, POLL_INTERVAL_MS);
      } else if (!should && timerRef.current !== null) {
        stopTimer();
      }
    }

    async function fetchOnce() {
      try {
        const matches = await api<Match[]>("/api/matches/today");
        if (!cancelled) {
          setData(matches);
          setError(null);
          startTimerIfNeeded(matches);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function maybeRefresh() {
      if (!cancelled && document.visibilityState === "visible") fetchOnce();
    }

    fetchOnce();
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, []);

  return { data, loading, error };
}
