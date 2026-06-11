// hooks לדף פרטי משחק: שולפים גם את המשחק עצמו וגם את ניחושי החברים.
//
// useMatch מרענן כל 30 שניות (רק כשהדף visible) כדי שתוצאה ושעון של משחק חי
// יתעדכנו אוטומטית. useMatchPredictions לא מרענן — ניחושים נעולים בזמן live.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match, MemberPrediction } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 30_000;

export function useMatch(matchId: number | null): HookResult<Match> {
  const [data, setData] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (matchId == null) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function fetchOnce() {
      try {
        const m = await api<Match>(`/api/matches/${matchId}`);
        if (!cancelled) {
          setData(m);
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
  }, [matchId]);

  return { data, loading, error };
}

export function useMatchPredictions(matchId: number | null): HookResult<MemberPrediction[]> {
  const [data, setData] = useState<MemberPrediction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (matchId == null) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const preds = await api<MemberPrediction[]>(`/api/matches/${matchId}/predictions`);
        if (!cancelled) setData(preds);
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
  }, [matchId]);

  return { data, loading, error };
}
