// קליינט HTTP פשוט מסביב fetch
// כל הקריאות ל-backend עוברות דרך כאן — מנהל JWT ושגיאות במקום אחד

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "mundial2026_token";
const TEMP_TOKEN_KEY = "mundial2026_temp_token";

// ניהול JWT ב-localStorage
// (בעתיד נעבור ל-httpOnly cookies אם נחליט שצריך אבטחה מוגברת)
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getTempToken(): string | null {
  return localStorage.getItem(TEMP_TOKEN_KEY);
}

export function setTempToken(token: string): void {
  localStorage.setItem(TEMP_TOKEN_KEY, token);
}

export function clearTempToken(): void {
  localStorage.removeItem(TEMP_TOKEN_KEY);
}

// מחלקת שגיאה שלנו — עוטפת שגיאות מה-API עם status ו-detail
export class ApiException extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

// אופציות לבקשת fetch
type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  // איזה טוקן לצרף לבקשה: 'session' (ברירת מחדל), 'temp', או 'none'
  auth?: "session" | "temp" | "none";
};

// פונקציה ראשית לקריאת API
// דוגמה: const data = await api<{ token: string }>('/api/auth/login', { method: 'POST', body: { username, pin } })
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = "session" } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // בחירת הטוקן לפי הסוג שביקשנו
  if (auth === "session") {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  } else if (auth === "temp") {
    const t = getTempToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new ApiException(response.status, detail);
  }

  // אם התגובה ריקה (204 No Content), מחזירים null
  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
