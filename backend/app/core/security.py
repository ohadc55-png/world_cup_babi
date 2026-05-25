"""bcrypt PIN hashing.

ה-PIN הוא 4 ספרות. אנחנו מאחסנים hash (לא PIN ברור) כדי שגם דליפת DB
לא תחשוף את ה-PIN של המשתמשים.
"""
import re
import bcrypt


PIN_PATTERN = re.compile(r"^\d{4}$")


def validate_pin_format(pin: str) -> None:
    """Raises ValueError אם ה-PIN לא בפורמט תקין."""
    if not PIN_PATTERN.fullmatch(pin):
        raise ValueError("PIN must be exactly 4 digits")


def hash_pin(pin: str) -> str:
    validate_pin_format(pin)
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    if not PIN_PATTERN.fullmatch(pin):
        return False
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False
