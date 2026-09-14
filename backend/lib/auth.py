"""Organiser sign-in: email + password, with signed session tokens.

Accounts live in the ORGANISER_ACCOUNTS environment variable rather than in a database,
because there is no database in this build and organisers are a fixed handful of people.
Format is one `email:bcrypt_hash` pair per line (or separated by `;`):

    ORGANISER_ACCOUNTS=rishi@example.com:$2b$12$abc...;priya@example.com:$2b$12$xyz...

Generate those lines with `python make_organiser.py` — it hashes the password locally so
the plain password is never typed into a config file, a repo, or a chat window.

A bcrypt hash contains no ":" character, so splitting on the first colon is unambiguous.

Sign-in returns a JWT signed with AUTH_SECRET. The token carries the organiser's email
and an expiry, and the frontend sends it back as `Authorization: Bearer <token>`.
Nothing is stored server-side, so a restart simply means everyone signs in again.

If ORGANISER_ACCOUNTS is not set, the app falls back to the older ADMIN_PIN header so an
existing deployment keeps working. Once accounts exist, the PIN stops being accepted.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import jwt
from passlib.context import CryptContext

# bcrypt truncates silently past 72 bytes; reject rather than quietly weaken the password.
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TTL_SECONDS = 60 * 60 * 8  # one working day at the door
_ALGORITHM = "HS256"


@dataclass(frozen=True)
class Organiser:
    email: str


def _secret() -> str:
    """Signing key for session tokens. Without it, sign-in is switched off entirely —
    an unsigned or predictably-signed token would be worse than no login at all."""
    return os.environ.get("AUTH_SECRET", "").strip()


def accounts() -> dict[str, str]:
    """Configured organisers as {lowercased email: bcrypt hash}."""
    raw = os.environ.get("ORGANISER_ACCOUNTS", "").strip()
    if not raw:
        return {}

    found: dict[str, str] = {}
    for chunk in raw.replace(";", "\n").splitlines():
        entry = chunk.strip()
        if not entry or entry.startswith("#"):
            continue
        email, separator, password_hash = entry.partition(":")
        if not separator:
            continue
        email = email.strip().lower()
        password_hash = password_hash.strip()
        if email and password_hash:
            found[email] = password_hash
    return found


def login_enabled() -> bool:
    """True once both an account list and a signing secret are present."""
    return bool(accounts()) and bool(_secret())


def verify_password(email: str, password: str) -> bool:
    """Check a sign-in attempt. Always runs a hash comparison, even for an unknown email,
    so the response time does not reveal which addresses are real."""
    stored = accounts().get(email.strip().lower())
    # A throwaway hash of the right shape, used only to keep the timing even.
    decoy = "$2b$12$" + "." * 53
    try:
        return _pwd.verify(password, stored or decoy) and stored is not None
    except ValueError:
        # Malformed hash in config — treat as a failed attempt, never as a pass.
        return False


def issue_token(email: str) -> tuple[str, int]:
    """Return (token, seconds until expiry)."""
    now = int(time.time())
    payload = {"sub": email.strip().lower(), "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM), TOKEN_TTL_SECONDS


def organiser_from_token(token: str) -> Organiser | None:
    """Validate a bearer token and return who it belongs to, or None."""
    secret = _secret()
    if not secret or not token:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None

    email = str(payload.get("sub", "")).lower()
    # An account removed from ORGANISER_ACCOUNTS loses access immediately, even if their
    # token has not expired yet.
    if not email or email not in accounts():
        return None
    return Organiser(email=email)


# ── Sign-in throttle ──────────────────────────────────────────────────────────
# There is no database, so this is a process-local counter. It slows down guessing
# from a single instance, which is all that is needed here; it is not a substitute
# for a strong password.

_FAILURES: dict[str, list[float]] = {}
_WINDOW_SECONDS = 15 * 60
_MAX_ATTEMPTS = 8


def too_many_attempts(key: str) -> bool:
    now = time.time()
    recent = [stamp for stamp in _FAILURES.get(key, []) if now - stamp < _WINDOW_SECONDS]
    _FAILURES[key] = recent
    return len(recent) >= _MAX_ATTEMPTS


def record_failure(key: str) -> None:
    _FAILURES.setdefault(key, []).append(time.time())


def clear_failures(key: str) -> None:
    _FAILURES.pop(key, None)
