"""Optional post-approval integrations.

Every adapter is disabled until its server-side environment values are present. Missing
configuration is reported as MOCKED instead of breaking attendee approval.
"""

import asyncio
import json
import os
from pathlib import Path
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from models.registration import IntegrationStatuses

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar.events",
]


def _google_service_account_configured() -> bool:
    """True once either credential source is set. Vercel (and most serverless
    hosts) has no writable disk to keep a key file on, so GOOGLE_SERVICE_ACCOUNT_JSON
    (the key file's raw JSON, pasted straight into an env var) is the one that works
    there. GOOGLE_SERVICE_ACCOUNT_FILE (a path on disk) still works for anyone
    self-hosting on a normal server or VM."""
    return bool(
        os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        or os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
    )


def _google_credentials() -> Any:
    from google.oauth2.service_account import Credentials

    inline_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if inline_json:
        return Credentials.from_service_account_info(json.loads(inline_json), scopes=SCOPES)

    service_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
    if service_file:
        return Credentials.from_service_account_file(service_file, scopes=SCOPES)

    return None


def _sheet_values(doc: dict[str, Any]) -> list[list[Any]]:
    return [[
        doc["id"],
        doc["full_name"],
        doc["email"],
        doc["phone"],
        doc["age"],
        doc["participant_type"],
        doc["discovery_source"],
        doc.get("discovery_other", "") or "",
        doc.get("payment_reference", "") or "",
        doc["status"],
        doc["approved_at"].isoformat() if doc.get("approved_at") else "",
    ]]


def _append_sheet(doc: dict[str, Any]) -> int | None:
    from googleapiclient.discovery import build

    credentials = _google_credentials()
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    response = service.spreadsheets().values().append(
        spreadsheetId=os.environ["GOOGLE_SHEET_ID"],
        range=os.environ.get("GOOGLE_SHEET_RANGE", "Registrations!A:K"),
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": _sheet_values(doc)},
    ).execute()

    updated_range = (response.get("updates") or {}).get("updatedRange", "")
    # Example: Registrations!A2:K2 -> row 2.
    try:
        row_part = updated_range.split("!")[-1].split(":")[0]
        digits = "".join(ch for ch in row_part if ch.isdigit())
        return int(digits) if digits else None
    except (TypeError, ValueError):
        return None


def _update_sheet_row(doc: dict[str, Any], row: int) -> None:
    from googleapiclient.discovery import build

    credentials = _google_credentials()
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    sheet_name = os.environ.get("GOOGLE_SHEET_RANGE", "Registrations!A:K").split("!")[0]
    service.spreadsheets().values().update(
        spreadsheetId=os.environ["GOOGLE_SHEET_ID"],
        range=f"{sheet_name}!A{row}:K{row}",
        valueInputOption="USER_ENTERED",
        body={"values": _sheet_values(doc)},
    ).execute()


def _create_calendar_event(doc: dict[str, Any]) -> None:
    from googleapiclient.discovery import build

    credentials = _google_credentials()
    service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
    event = {
        "summary": "THE BOND — Tote Bag Bedazzling Party",
        "description": (
            f"Hi {doc['full_name']}, your booking is confirmed.\n"
            "We can’t wait to create, connect and bedazzle with you."
        ),
        "location": "Sayaji Bagh, Vadodara",
        "start": {"dateTime": os.environ["EVENT_START"], "timeZone": os.environ.get("EVENT_TIMEZONE", "Asia/Kolkata")},
        "end": {"dateTime": os.environ["EVENT_END"], "timeZone": os.environ.get("EVENT_TIMEZONE", "Asia/Kolkata")},
        "attendees": [{"email": doc["email"], "displayName": doc["full_name"]}],
    }
    service.events().insert(
        calendarId=os.environ["GOOGLE_CALENDAR_ID"], body=event, sendUpdates="all"
    ).execute()


def _send_invitation_email(doc: dict[str, Any]) -> None:
    message = EmailMessage()
    message["Subject"] = os.environ.get("EMAIL_SUBJECT", "✨ You’re Invited: Make It Yours at The Bond")
    message["From"] = os.environ["MAIL_FROM"]
    message["To"] = doc["email"]
    plain = (
        f"Hi {doc['full_name']},\n\n"
        "Your place at THE BOND — Tote Bag Bedazzling Party is confirmed.\n"
        "Thursday, 17 September 2026 · 5:30 PM–7:30 PM\n"
        "Sayaji Bagh, Vadodara\n\n"
        "Entry: ₹359. Come create, connect and bedazzle with us.\n"
        "Instagram: https://www.instagram.com/thebondconnection_/\n"
        "WhatsApp: https://chat.whatsapp.com/BfdNYpnFY1o2l7eINv1mKM\n\n"
        "With love,\nThe Bond"
    )
    html = f"""
    <html><body style="margin:0;background:#eadfd6;font-family:Georgia,serif;color:#34251f;padding:28px 16px">
      <div style="max-width:560px;margin:auto;background:#fffaf2;border:1px solid #c9a993;padding:34px 30px;box-shadow:0 10px 30px #8c6a5b33">
        <div style="text-align:center;color:#714d44;letter-spacing:4px;font-size:12px">THE BOND</div>
        <div style="text-align:center;color:#9c7770;letter-spacing:3px;font-size:10px;margin-top:8px">WHERE CREATIVITY MEETS CONNECTION</div>
        <p style="text-align:right;color:#9a6b62;font-style:italic;font-size:18px">More people<br/>Brighter stories ♡</p>
        <h1 style="font-weight:normal;font-size:30px;margin:24px 0 12px">Hey there, {doc['full_name']}! ♡</h1>
        <p style="font-size:17px;line-height:1.65">Your spot at The Bond — Tote Bag Bedazzling Party is officially confirmed! We’re so excited to have you with us for an evening filled with creativity, connection, sparkle and good vibes.</p>
        <div style="background:#ead9d1;padding:18px 20px;margin:24px 0;line-height:1.8">
          <div style="letter-spacing:4px;font-size:11px">EVENT DETAILS</div>
          <strong>Tote Bag Bedazzling Party</strong><br/>
          Thursday, 17 September 2026 · 5:30 PM–7:30 PM<br/>
          Sayaji Bagh, Vadodara<br/>
          Entry confirmed · ₹359
        </div>
        <p style="font-size:16px;line-height:1.7">Get ready to customise your very own tote bag, meet new people, enjoy a refreshing drink, and take home a little surprise. Please arrive a few minutes early so we can begin the experience on time.</p>
        <p style="font-size:16px;line-height:1.7">Follow along on <a href="https://www.instagram.com/thebondconnection_/" style="color:#9a6b62">Instagram</a> and join the <a href="https://chat.whatsapp.com/BfdNYpnFY1o2l7eINv1mKM" style="color:#9a6b62">WhatsApp community</a>.</p>
        <p style="font-size:22px;font-style:italic;margin-top:34px">With love,<br/>The Bond 🤍</p>
      </div>
    </body></html>
    """
    message.set_content(plain)
    message.add_alternative(html, subtype="html")
    _send_smtp_message(message)


def _send_smtp_message(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


async def dispatch_registration_sheet(doc: dict[str, Any]) -> tuple[str, int | None]:
    configured = _google_service_account_configured() and bool(os.environ.get("GOOGLE_SHEET_ID"))
    if not configured:
        return "MOCKED — add Sheet credentials", None
    try:
        row = await asyncio.to_thread(_append_sheet, doc)
        return "SYNCED", row
    except Exception:
        return "FAILED — check hosting configuration", None


async def dispatch_post_approval(doc: dict[str, Any]) -> IntegrationStatuses:
    statuses: dict[str, str] = {}

    async def run(name: str, configured: bool, callback: Any, mocked_message: str) -> None:
        if not configured:
            statuses[name] = mocked_message
            return
        try:
            await asyncio.to_thread(callback, doc)
            statuses[name] = "SENT" if name == "email" else "SYNCED"
        except Exception:
            statuses[name] = "FAILED — check hosting configuration"

    await asyncio.gather(
        run(
            "google_calendar",
            _google_service_account_configured()
            and bool(os.environ.get("GOOGLE_CALENDAR_ID") and os.environ.get("EVENT_START") and os.environ.get("EVENT_END")),
            _create_calendar_event,
            "MOCKED — add Calendar credentials",
        ),
        run(
            "email",
            bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USERNAME") and os.environ.get("SMTP_PASSWORD") and os.environ.get("MAIL_FROM")),
            _send_invitation_email,
            "MOCKED — add SMTP credentials",
        ),
    )
    return IntegrationStatuses(**statuses)