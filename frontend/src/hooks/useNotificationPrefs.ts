// hook לקבלה + עדכון של העדפות התראות.

import { useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import type { NotificationPrefs, PrefsResponse } from "@/types";

const DEFAULT_PREFS: NotificationPrefs = {
  reminder: true,
  result: true,
  overtaken: true,
  kickoff: false,
  stage: true,
  weekly: true,
};

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api<PrefsResponse>("/api/push/preferences");
      setPrefs(res.prefs);
      setHasSubscription(res.has_subscription);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updatePref<K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) {
    // optimistic: מעדכנים מיד, אם נכשל מחזירים
    const prev = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    setError(null);
    try {
      const res = await api<PrefsResponse>("/api/push/preferences", {
        method: "PUT",
        body: next,
      });
      setPrefs(res.prefs);
    } catch (e) {
      setPrefs(prev);
      if (e instanceof ApiException && e.status === 404) {
        setError("הפעל התראות קודם בעמוד הבית");
      } else {
        setError("שגיאה בשמירת ההעדפות");
      }
    } finally {
      setSaving(false);
    }
  }

  return {
    prefs,
    hasSubscription,
    loading,
    saving,
    error,
    updatePref,
    refresh: load,
  };
}
