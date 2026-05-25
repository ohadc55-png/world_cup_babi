// Hook לדריבוט נתוני קבוצות מטבלת המשחקים.
// במקום endpoint נפרד, אנחנו שולפים את כל המשחקים פעם אחת (סך הכל 104) ומחשבים
// כל מה שצריך בצד הלקוח.

import { useEffect, useMemo, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { Match } from "@/types";

type TeamsData = {
  teamsByGroup: Record<string, string[]>; // 'A' → 4 שמות (באנגלית)
  allTeams: string[]; // 48 קבוצות שונות, ממוין אלפביתית
};

export function useAllTeams() {
  const [data, setData] = useState<TeamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const matches = await api<Match[]>("/api/matches?stage=group");
        if (cancelled) return;

        const byGroup: Record<string, Set<string>> = {};
        for (const m of matches) {
          if (!m.group_name) continue;
          if (!byGroup[m.group_name]) byGroup[m.group_name] = new Set();
          byGroup[m.group_name].add(m.team_home);
          byGroup[m.group_name].add(m.team_away);
        }

        const teamsByGroup: Record<string, string[]> = {};
        const allSet = new Set<string>();
        for (const [g, set] of Object.entries(byGroup)) {
          // ממוין אלפביתית להצגה עקבית; המשתמש יסדר מחדש לפי הניחוש
          teamsByGroup[g] = Array.from(set).sort();
          for (const t of set) allSet.add(t);
        }

        setData({
          teamsByGroup,
          allTeams: Array.from(allSet).sort(),
        });
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

// רשימת מזהי קבוצות לפי סדר אלפביתי (A..L)
export function useGroupNames(): string[] {
  const { data } = useAllTeams();
  return useMemo(() => {
    if (!data) return [];
    return Object.keys(data.teamsByGroup).sort();
  }, [data]);
}
