// hooks לטבלאות מצטייני הטורניר (מלך שערים + מלך בישולים).
//
// אין polling אקטיבי — ה-server מעדכן כל שעה ממילא. עושים fetch אחד
// על mount + רענון נוסף ב-visibilitychange כדי שמשתמשים שחוזרים ללשונית
// יראו את הנתונים העדכניים.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { PlayerStat } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

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
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      cancelled = true;
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
