"""Criterion: Optional integrations (email/Sheets/Calendar) degrade safely without secrets."""

import os
import uuid

ADMIN_PIN = os.environ.get("ADMIN_PIN", "bond-demo-2026")


def _unique_email() -> str:
    return f"tscheck-integmocked-{uuid.uuid4().hex[:10]}@example.com"


def test_approval_reports_mocked_integration_statuses_without_secrets(client):
    payload = {
        "full_name": "Tscheck Integrations",
        "email": _unique_email(),
        "phone": "9876522222",
        "age": "22",
        "participant_type": "Other",
        "discovery_source": "Colleagues",
        "discovery_other": None,
        "payment_reference": None,
    }
    created = client.post("/registrations", json=payload).json()
    reg_id = created["registration"]["id"]

    # New registration already reports MOCKED integrations before any approval.
    assert created["registration"]["integration_statuses"]["email"].startswith("MOCKED")
    assert created["registration"]["integration_statuses"]["google_sheets"].startswith("MOCKED")
    assert created["registration"]["integration_statuses"]["google_calendar"].startswith("MOCKED")

    client.post(
        f"/registrations/{reg_id}/proof",
        data={"payment_reference": "UTR555000111"},
        files={"proof": ("proof.png", b"\x89PNG\r\n\x1a\n" + b"2" * 32, "image/png")},
    )
    approve_resp = client.post(
        f"/admin/registrations/{reg_id}/approve", headers={"X-Admin-Pin": ADMIN_PIN}
    )
    assert approve_resp.status_code == 200, approve_resp.text
    statuses = approve_resp.json()["registration"]["integration_statuses"]

    # Without SMTP/Google credentials configured in this environment, approval
    # must not fail and must never leak secrets — it reports MOCKED for each channel.
    if not (os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USERNAME")):
        assert statuses["email"].startswith("MOCKED")
    if not (os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE") and os.environ.get("GOOGLE_SHEET_ID")):
        assert statuses["google_sheets"].startswith("MOCKED")
    if not (os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE") and os.environ.get("GOOGLE_CALENDAR_ID")):
        assert statuses["google_calendar"].startswith("MOCKED")
