"""One-day-before reminder worker for approved attendees."""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from lib.db import db
from lib.integrations import _send_smtp_message


def _smtp_configured() -> bool:
    return all(
        os.environ.get(key)
        for key in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "MAIL_FROM")
    )


def _event_start() -> datetime:
    value = os.environ.get("EVENT_START", "2026-09-17T17:30:00+05:30")
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _send_reminder_email(doc: dict[str, Any]) -> None:
    message = EmailMessage()
    message["Subject"] = os.environ.get("REMINDER_SUBJECT", "✨ See you tomorrow at The Bond")
    message["From"] = os.environ["MAIL_FROM"]
    message["To"] = doc["email"]
    message.set_content(
        f"Hi {doc['full_name']},\n\n"
        "A little reminder: The Bond Tote Bag Bedazzling Party is tomorrow!\n"
        "Thursday, 17 September 2026 · 5:30 PM–7:30 PM\n"
        "Sayaji Bagh, Vadodara\n\n"
        "Come a few minutes early, bring your creativity, and get ready for a lovely evening.\n\n"
        "With love,\nThe Bond 🤍"
    )
    message.add_alternative(
        f"""
        <html><body style="margin:0;background:#eadfd6;font-family:Georgia,serif;color:#34251f;padding:28px 16px">
          <div style="max-width:560px;margin:auto;background:#fffaf2;border:1px solid #c9a993;padding:34px 30px;box-shadow:0 10px 30px #8c6a5b33">
            <div style="text-align:center;color:#714d44;letter-spacing:4px;font-size:12px">THE BOND</div>
            <div style="text-align:center;color:#9c7770;letter-spacing:3px;font-size:10px;margin-top:8px">WHERE CREATIVITY MEETS CONNECTION</div>
            <p style="text-align:right;color:#9a6b62;font-style:italic;font-size:18px">More people<br/>Brighter stories ♡</p>
            <h1 style="font-weight:normal;font-size:30px;margin:24px 0 12px">See you tomorrow, {doc['full_name']}!</h1>
            <p style="font-size:17px;line-height:1.65">Your tote bag, your sparkle, your people — everything is waiting for you at The Bond.</p>
            <div style="background:#ead9d1;padding:18px 20px;margin:24px 0;line-height:1.8">
              <div style="letter-spacing:4px;font-size:11px">EVENT DETAILS</div>
              <strong>Tote Bag Bedazzling Party</strong><br/>
              Thursday, 17 September 2026 · 5:30 PM–7:30 PM<br/>
              Sayaji Bagh, Vadodara
            </div>
            <p style="font-size:16px;line-height:1.7">Please arrive a few minutes early so we can begin the experience on time. We can’t wait to see what you create! ✨</p>
            <p style="font-size:22px;font-style:italic;margin-top:34px">With love,<br/>The Bond 🤍</p>
          </div>
        </body></html>
        """,
        subtype="html",
    )
    _send_smtp_message(message)


async def _send_due_reminders() -> None:
    if not _smtp_configured():
        return
    now = datetime.now(timezone.utc)
    start = _event_start().astimezone(timezone.utc)
    due_from = start - timedelta(days=1)
    if not due_from <= now < start:
        return

    attendees = await db.registrations.find(
        {"status": "paid", "reminder_sent_at": {"$exists": False}}
    ).to_list(500)
    for attendee in attendees:
        try:
            await asyncio.to_thread(_send_reminder_email, attendee)
            await db.registrations.update_one(
                {"id": attendee["id"], "status": "paid", "reminder_sent_at": {"$exists": False}},
                {"$set": {"reminder_sent_at": datetime.now(timezone.utc), "reminder_status": "SENT"}},
            )
        except Exception:
            await db.registrations.update_one(
                {"id": attendee["id"], "status": "paid"},
                {"$set": {"reminder_status": "FAILED — check SMTP configuration"}},
            )


async def reminder_loop() -> None:
    while True:
        try:
            await _send_due_reminders()
        except Exception:
            pass
        await asyncio.sleep(60)