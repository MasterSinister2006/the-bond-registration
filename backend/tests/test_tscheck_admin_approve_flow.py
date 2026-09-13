"""Criterion: Organizer can approve a submitted payment (PIN-gated)."""

import os
import uuid

ADMIN_PIN = os.environ.get("ADMIN_PIN", "bond-demo-2026")


def _unique_email() -> str:
    return f"tscheck-adminflow-{uuid.uuid4().hex[:10]}@example.com"


def _create_and_submit_proof(client) -> str:
    payload = {
        "full_name": "Tscheck Admin Flow",
        "email": _unique_email(),
        "phone": "9876511111",
        "age": "27",
        "participant_type": "Working Professional",
        "discovery_source": "Friends",
        "discovery_other": None,
        "payment_reference": None,
    }
    created = client.post("/registrations", json=payload).json()
    reg_id = created["registration"]["id"]
    client.post(
        f"/registrations/{reg_id}/proof",
        data={"payment_reference": "UTR987654321"},
        files={"proof": ("proof.png", b"\x89PNG\r\n\x1a\n" + b"1" * 32, "image/png")},
    )
    return reg_id


def test_admin_rejects_wrong_pin(client):
    resp = client.get("/admin/registrations", headers={"X-Admin-Pin": "wrong-pin"})
    assert resp.status_code == 401


def test_admin_can_approve_proof_submitted_booking(client):
    reg_id = _create_and_submit_proof(client)

    list_resp = client.get("/admin/registrations", headers={"X-Admin-Pin": ADMIN_PIN})
    assert list_resp.status_code == 200, list_resp.text
    ids = [row["id"] for row in list_resp.json()]
    assert reg_id in ids

    approve_resp = client.post(
        f"/admin/registrations/{reg_id}/approve", headers={"X-Admin-Pin": ADMIN_PIN}
    )
    assert approve_resp.status_code == 200, approve_resp.text
    body = approve_resp.json()
    assert body["registration"]["status"] == "paid"
    assert body["registration"]["approved_at"] is not None

    # Attendee-visible status reflects paid.
    get_resp = client.get(f"/registrations/{reg_id}")
    assert get_resp.json()["status"] == "paid"

    # Re-approving an already-paid booking must not be allowed twice.
    second_approve = client.post(
        f"/admin/registrations/{reg_id}/approve", headers={"X-Admin-Pin": ADMIN_PIN}
    )
    assert second_approve.status_code == 409
