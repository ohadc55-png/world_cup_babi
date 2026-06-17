// hooks לטבלאות מצטייני הטורניר (מלך שערים + מלך בישולים).
//
// ה-server מעדכן את הטבלאות פעם בשעה דרך הקרון. כדי שמשתמש שמסתכל ברצף
// על המסך יקבל עדכון אחרי שהקרון רץ — polling רך כל 10 דקות. גם
// visibilitychange עושה fetch כשמשתמש חוזר לטאב.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { PlayerStat } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 דקות

function usePlayerStatsList(endpoint: string): HookResult<PlayerStat[]> {
  const [data, setData] = useState<PlayerStat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const list = await api<PlayerStat[]>(endpoint);
        if (!cancelled) {
          setData(list);
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
  }, [endpoint]);

  return { data, loading, error };
}

export function useTopScorers() {
  return usePlayerStatsList("/api/tournament/top-scorers");
}

export function useTopAssisters() {
  return usePlayerStatsList("/api/tournament/top-assisters");
}
