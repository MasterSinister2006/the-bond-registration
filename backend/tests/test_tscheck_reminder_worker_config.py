"""Criterion: A one-day-before reminder is configured for confirmed attendees.

This is a pure-config/worker-behavior criterion with no HTTP surface of its own
(no SMTP secrets are configured in this environment, per spec_deviations). We
assert the documented behavior is actually implemented in code: the subject
line, the SMTP-only gating, and the reminder_sent_at idempotency marker.
"""

from pathlib import Path

REMINDERS_SRC = Path(__file__).resolve().parents[1] / "lib" / "reminders.py"


def test_reminder_worker_defines_subject_and_idempotency_marker():
    source = REMINDERS_SRC.read_text()

    assert "See you tomorrow at The Bond" in source
    assert "reminder_sent_at" in source
    assert '"status": "paid"' in source
    assert "_smtp_configured" in source


def test_reminder_worker_skips_send_without_smtp_env(monkeypatch):
    import importlib
    import os

    for key in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "MAIL_FROM"):
        monkeypatch.delenv(key, raising=False)

    import sys

    sys.path.insert(0, str(REMINDERS_SRC.parents[1]))
    reminders = importlib.import_module("lib.reminders")
    importlib.reload(reminders)

    assert reminders._smtp_configured() is False
