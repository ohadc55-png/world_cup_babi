// Hook ל-Bumps Chart (תת-טאב "התקדמות" בעמוד /leaderboard).
//
// הנתונים זזים רק כשמשחק חדש מסתיים — אין צורך ב-polling אקטיבי.
// fetch אחד על mount + refresh על visibilitychange (כשמשתמש חוזר ל-tab).

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { TimelineResponse } from "@/types";

type HookResult = {
  data: TimelineResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useLeaderboardTimeline(): HookResult {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const resp = await api<TimelineResponse>("/api/leaderboard/timeline");
        if (!cancelled) {
          setData(resp);
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
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
