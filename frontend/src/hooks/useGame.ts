// hook לקבלת המשחק הנוכחי של המשתמש (אם יש).
//
// `useMyGame()` שולח GET /api/games/mine, מחזיר { game, loading, error, refetch }
//
// משמש בעמוד GameSelect (כדי לדעת אם להציג / לדלג ל-/home), ובכל מקום שצריך
// להציג שם המשחק או invite code.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Game } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useMyGame(): HookResult<Game> {
  const [data, setData] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // ה-endpoint מחזיר Game | null
        const game = await api<Game | null>("/api/games/mine");
        if (!cancelled) {
          setData(game);
          setError(null);
        }
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
