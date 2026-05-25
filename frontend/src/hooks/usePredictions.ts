// Hooks לניחושי המשתמש — match predictions + DD tokens.
// משתמש ב-useState/useEffect קלאסי + פונקציית refresh חיצונית.

import { useCallback, useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { DoubleDownToken, GroupPrediction, MatchPrediction, TournamentPredictions } from "@/types";

// ====================================================
// useMyMatchPredictions — כל ניחושי המשחקים של המשתמש,
// מקובצים לפי match_id לגישה מהירה.
// ====================================================
export function useMyMatchPredictions() {
  const [byMatchId, setByMatchId] = useState<Record<number, MatchPrediction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useCallback = ממשיך את הזהות של הפונקציה בין רינדורים, חשוב אם מעבירים אותה לרכיבים
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api<MatchPrediction[]>("/api/predictions/matches");
      const map: Record<number, MatchPrediction> = {};
      for (const p of list) map[p.match_id] = p;
      setByMatchId(map);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // עדכון מקומי אחרי שמירה מוצלחת — חוסך round-trip
  const setLocalPrediction = useCallback((p: MatchPrediction) => {
    setByMatchId((prev) => ({ ...prev, [p.match_id]: p }));
  }, []);

  return { byMatchId, loading, error, refresh, setLocalPrediction };
}

// ====================================================
// useMyGroupPredictions — ניחושי טבלאות הבתים של המשתמש
// ====================================================
export function useMyGroupPredictions() {
  const [byGroup, setByGroup] = useState<Record<string, GroupPrediction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api<GroupPrediction[]>("/api/predictions/groups");
      const map: Record<string, GroupPrediction> = {};
      for (const p of list) map[p.group_name] = p;
      setByGroup(map);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setLocal = useCallback((p: GroupPrediction) => {
    setByGroup((prev) => ({ ...prev, [p.group_name]: p }));
  }, []);

  return { byGroup, loading, error, refresh, setLocal };
}

// ====================================================
// useMyTournamentPredictions — ניחושי טווח-ארוך (champion, finalists, ...)
// ====================================================
export function useMyTournamentPredictions() {
  const [data, setData] = useState<TournamentPredictions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api<TournamentPredictions | null>("/api/predictions/tournament");
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setLocal = useCallback((p: TournamentPredictions) => {
    setData(p);
  }, []);

  return { data, loading, error, refresh, setLocal };
}

// ====================================================
// useMyDoubleDownTokens — 8 הז'יטונים של המשתמש,
// מקובצים לפי round_key.
// ====================================================
export function useMyDoubleDownTokens() {
  const [tokens, setTokens] = useState<DoubleDownToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api<DoubleDownToken[]>("/api/predictions/double-down");
      setTokens(list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tokens, loading, error, refresh };
}
