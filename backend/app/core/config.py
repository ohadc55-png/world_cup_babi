from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_ANON_KEY: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 720

    API_FOOTBALL_KEY: str = ""

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:ohadc55@gmail.com"

    FRONTEND_URL: str = "http://localhost:5173"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    ADMIN_USER_ID: str = ""

    # === Phase 8 — AI Agent ===
    ANTHROPIC_API_KEY: str = ""  # ריק = הסוכן יחזיר שגיאה ידידותית; המשתמש מוסיף ב-.env
    # Sonnet 4.6 — חזק משמעותית מ-Haiku לעברית עשירה, multi-step reasoning,
    # ושמירת קונטקסט שיחה ארוכה. נדרש לאיכות תשובות על חוקים.
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    AGENT_MAX_HISTORY_MESSAGES: int = 50   # קונטקסט שנשלח ל-Claude (חיתוך כדי לחסוך עלויות)
    AGENT_MAX_TOOL_ITERATIONS: int = 5     # מקסימום מעגלי tool_use לפני fallback

    # === Long-term prediction grace period (admin emergency override) ===
    # Allows specific user_ids to edit their group-standings predictions
    # AFTER the tournament started (normally locked). Used to let stragglers
    # complete missing predictions when fairness allows.
    # Format: comma-separated UUIDs + an ISO-8601 UTC deadline.
    # Empty = no grace, normal locking applies.
    LONGTERM_GRACE_USER_IDS: str = ""
    LONGTERM_GRACE_UNTIL: str = ""    # e.g. "2026-06-12T10:00:00+00:00"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
