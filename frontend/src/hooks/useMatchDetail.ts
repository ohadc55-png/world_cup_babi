// hooks לדף פרטי משחק: שולפים גם את המשחק עצמו וגם את ניחושי החברים.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match, MemberPrediction } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

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
    (async () => {
      try {
        const m = await api<Match>(`/api/matches/${matchId}`);
        if (!cancelled) setData(m);
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
