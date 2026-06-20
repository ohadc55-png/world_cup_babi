// Hooks לניחושי טווח-ארוך — תצוגת "מי ניחש מה".
//
// הניחושים נעולים שעה לפני המונדיאל, אז אין צורך ב-polling. fetch אחד
// על mount + refresh על visibilitychange (אם משתמש סגר וחזר אחרי כמה דק').

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { MemberTournamentPrediction } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useAllTournamentPredictions(): HookResult<MemberTournamentPrediction[]> {
  const [data, setData] = useState<MemberTournamentPrediction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const list = await api<MemberTournamentPrediction[]>("/api/tournament/all-predictions");
        if (!cancelled) {
          setData(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          // 403 = הטורניר עוד לא התחיל. נציג הודעה ידידותית.
          if (e instanceof ApiException && e.status === 403) {
            setError("ייפתח אחרי תחילת המונדיאל");
          } else {
            setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
          }
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
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, []);

  return { data, loading, error };
}
