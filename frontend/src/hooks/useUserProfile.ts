// hook ל-/api/users/:id/profile — מחזיר פרופיל ציבורי של חבר במשחק.
// המידע נחשף לפי tournament_has_started + locked-state של כל משחק (backend מטפל).

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { UserProfile } from "@/types";

type HookResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useUserProfile(userId: string | null): HookResult<UserProfile> {
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await api<UserProfile>(`/api/users/${userId}/profile`);
        if (!cancelled) setData(p);
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
  }, [userId]);

  return { data, loading, error };
}
