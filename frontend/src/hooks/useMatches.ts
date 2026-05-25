// Hooks לשליפת משחקים מה-API
//
// משתמשים ב-useState + useEffect קלאסי (לא Tanstack Query עדיין — נשמור לימים אם נצטרך).
// כל hook מחזיר { data, loading, error } שזה הפורמט הסטנדרטי בקהילת React.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// ====================================================
// useNextMatch — המשחק הבא שעוד לא התחיל
// ====================================================
export function useNextMatch(): HookResult<Match> {
  const [data, setData] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const match = await api<Match | null>("/api/matches/next");
        if (!cancelled) setData(match);
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
// useMatchesToday — משחקי היום (UTC)
// ====================================================
export function useMatchesToday(): HookResult<Match[]> {
  const [data, setData] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const matches = await api<Match[]>("/api/matches/today");
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
