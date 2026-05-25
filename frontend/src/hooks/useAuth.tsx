// React Context + hook לניהול state של המשתמש המחובר.
//
// תיקון חשוב (2026-05-23): פעם הקוד מחק את ה-token בכל שגיאה. עכשיו רק על
// 401/403 (טוקן לא חוקי). על שגיאות רשת — מחזיק את הטוקן וחושף `networkError`,
// כדי שהמשתמש לא יאבד את הסשן רק כי ה-backend היה כבוי לרגע.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiException, clearToken, getToken, setToken } from "@/lib/api";
import type { AuthSuccessResponse, CurrentUser } from "@/types";

type AuthState = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** true = backend לא נגיש, אבל הטוקן נשמר. תנסה refresh כשהשרת חוזר. */
  networkError: boolean;
};

type AuthActions = {
  setSession: (auth: AuthSuccessResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  /** עדכון מקומי של game_id (אחרי create/join/leave game) */
  setGameId: (gameId: string | null) => void;
};

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  async function fetchMe() {
    const token = getToken();
    if (!token) {
      setUser(null);
      setNetworkError(false);
      setIsLoading(false);
      return;
    }
    try {
      const me = await api<CurrentUser>("/api/auth/me");
      setUser(me);
      setNetworkError(false);
    } catch (err) {
      // רק על 401/403 ננקה את הטוקן (טוקן באמת לא חוקי)
      if (err instanceof ApiException && (err.status === 401 || err.status === 403)) {
        clearToken();
        setUser(null);
        setNetworkError(false);
      } else {
        // שגיאת רשת / backend down — שומרים את הטוקן, מסמנים networkError
        // המשתמש לא ייזרק החוצה; קריאה הבאה (refresh / רענון דף) תנסה שוב
        setUser(null);
        setNetworkError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  function setSession(auth: AuthSuccessResponse) {
    setToken(auth.token);
    setUser({
      id: auth.user_id,
      username: auth.username,
      is_admin: auth.is_admin,
      game_id: auth.game_id,
    });
    setNetworkError(false);
  }

  function logout() {
    clearToken();
    setUser(null);
    setNetworkError(false);
  }

  function setGameId(gameId: string | null) {
    setUser((prev) => (prev ? { ...prev, game_id: gameId } : prev));
  }

  async function refresh() {
    setIsLoading(true);
    await fetchMe();
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    networkError,
    setSession,
    logout,
    refresh,
    setGameId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth חייב להיות בתוך <AuthProvider>");
  }
  return ctx;
}
