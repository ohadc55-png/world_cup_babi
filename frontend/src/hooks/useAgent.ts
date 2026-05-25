// hook לניהול שיחת הסוכן — טוען היסטוריה, שולח הודעות, מנהל loading/error.

import { useCallback, useEffect, useState } from "react";
import { agentApi } from "@/lib/agentApi";
import { ApiException } from "@/lib/api";
import type { AgentMessage } from "@/types";

type AgentState = {
  messages: AgentMessage[];
  welcome: string | null;
  suggestions: string[];
  isLoading: boolean;          // true בזמן שאנחנו מחכים לתשובה מ-Claude
  isInitializing: boolean;     // true רק בטעינה ראשונית של ההיסטוריה
  error: string | null;
  send: (message: string) => Promise<void>;
  reset: () => Promise<void>;
};

export function useAgent(enabled: boolean): AgentState {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // טוען היסטוריה כשה-hook מתחיל (אבל רק אם enabled = true — כדי לא לקרוא ל-API לפני שצריך)
  const loadHistory = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const data = await agentApi.getHistory();
      setMessages(data.messages);
      setWelcome(data.welcome);
      setSuggestions(data.suggestions);
    } catch (e) {
      setError(
        e instanceof ApiException
          ? e.status === 403
            ? "הסוכן זמין רק אחרי שאתה מצטרף למשחק."
            : `שגיאה ${e.status}`
          : "שגיאת רשת",
      );
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      loadHistory();
    }
  }, [enabled, loadHistory]);

  const send = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    // אופטימיסטי: מציגים את הודעת המשתמש מיד
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSuggestions([]); // מסתירים הצעות אחרי שליחה ראשונה
    setIsLoading(true);
    setError(null);

    try {
      const res = await agentApi.sendMessage(trimmed);
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch (e) {
      const msg =
        e instanceof ApiException
          ? e.status === 503
            ? "הסוכן עוד לא הופעל (אין מפתח Anthropic). תוסיף מפתח ל-.env ותפעיל מחדש את ה-backend."
            : `שגיאה ${e.status}`
          : "שגיאת רשת";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `אופס — ${msg} 🤖` },
      ]);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const reset = useCallback(async () => {
    try {
      await agentApi.resetConversation();
      setMessages([]);
      await loadHistory(); // טוען מחדש כדי לקבל welcome + suggestions
    } catch (e) {
      setError(e instanceof ApiException ? `שגיאה ${e.status}` : "שגיאת רשת");
    }
  }, [loadHistory]);

  return {
    messages,
    welcome,
    suggestions,
    isLoading,
    isInitializing,
    error,
    send,
    reset,
  };
}
