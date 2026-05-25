// hook לטבלאות הבתים החיות (12 טבלאות).

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { GroupStanding } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useGroupStandings(): HookResult<GroupStanding[]> {
  const [data, setData] = useState<GroupStanding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const standings = await api<GroupStanding[]>("/api/groups/standings");
        if (!cancelled) setData(standings);
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
