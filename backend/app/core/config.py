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
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    AGENT_MAX_HISTORY_MESSAGES: int = 50   # קונטקסט שנשלח ל-Claude (חיתוך כדי לחסוך עלויות)
    AGENT_MAX_TOOL_ITERATIONS: int = 5     # מקסימום מעגלי tool_use לפני fallback


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
