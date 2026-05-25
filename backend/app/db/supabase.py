"""
Supabase clients.

הערה: postgrest-py משתמש ב-HTTP/2 כברירת מחדל, אבל ה-edge של Supabase
מנתק את החיבור לפעמים עם COMPRESSION_ERROR (HTTP/2 error_code 9).
התוצאה: בקשות נכשלות עם 500 Internal Server Error באקראי.

הפתרון: לכפות HTTP/1.1 על ה-httpx session של postgrest — יותר יציב,
ביצועים כמעט זהים, כי הקריאות הן רובן GET/POST קצרות.
"""
import httpx
from supabase import create_client, Client

from app.core.config import settings


def _make_client(url: str, key: str) -> Client:
    client = create_client(url, key)

    # מחליפים את ה-httpx session ב-postgrest ל-HTTP/1.1 (יציב יותר עם Supabase)
    old_session = client.postgrest.session
    new_session = httpx.Client(
        base_url=old_session.base_url,
        headers=dict(old_session.headers),
        timeout=old_session.timeout,
        http2=False,
    )
    client.postgrest.session = new_session
    old_session.close()

    return client


supabase_admin: Client = _make_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
"""לקוח עם service_role — עוקף RLS. לשימוש שרת בלבד."""

supabase_anon: Client = _make_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
"""לקוח anonymous — לשימוש כאשר רוצים שה-RLS יחול."""
