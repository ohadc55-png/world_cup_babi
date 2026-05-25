// Hooks ל-Leaderboard
//
// useLeaderboard — כל הטבלה
// useMyScore — הניקוד שלי + פערים מהמיקום הסמוך

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { LeaderboardEntry, MyScoreDetail } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useLeaderboard(): HookResult<LeaderboardEntry[]> {
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const entries = await api<LeaderboardEntry[]>("/api/leaderboard");
        if (!cancelled) setData(entries);
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
  }, [tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}

export function useMyScore(): HookResult<MyScoreDetail> {
  const [data, setData] = useState<MyScoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const me = await api<MyScoreDetail>("/api/leaderboard/me");
        if (!cancelled) setData(me);
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
  }, [tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
