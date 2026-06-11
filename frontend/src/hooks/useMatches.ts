// Hooks לשליפת משחקים מה-API
//
// משתמשים ב-useState + useEffect קלאסי (לא Tanstack Query עדיין — נשמור לימים אם נצטרך).
// כל hook מחזיר { data, loading, error } שזה הפורמט הסטנדרטי בקהילת React.
//
// Polling: useNextMatch + useMatchesToday מרעננים כל 30 שניות כשהדף visible
// (כדי לראות תוצאות חיות בלי לרענן). הפסקה אוטומטית כשעוברים ללשונית אחרת.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 30_000;

// ====================================================
// useNextMatch — המשחק הבא (או LIVE אם יש כזה)
// ====================================================
export function useNextMatch(): HookResult<Match> {
  const [data, setData] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const match = await api<Match | null>("/api/matches/next");
        if (!cancelled) {
          setData(match);
          setError(null);
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
    const timer = window.setInterval(maybeRefresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
// useMatchesToday — משחקי היום (UTC), polling כל 30s לעדכוני LIVE
// ====================================================
export function useMatchesToday(): HookResult<Match[]> {
  const [data, setData] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const matches = await api<Match[]>("/api/matches/today");
        if (!cancelled) {
          setData(matches);
          setError(null);
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
    const timer = window.setInterval(maybeRefresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, []);

  return { data, loading, error };
}
