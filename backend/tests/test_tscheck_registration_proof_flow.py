"""Criterion: Attendee can submit required registration and payment proof.

Happy path: create a registration (awaiting_payment) then upload UTR + proof
image (proof_submitted). Failure case: invalid proof content-type is rejected.
"""

import uuid

import httpx


def _unique_email() -> str:
    return f"tscheck-regflow-{uuid.uuid4().hex[:10]}@example.com"


def _payload(email: str) -> dict:
    return {
        "full_name": "Tscheck Attendee",
        "email": email,
        "phone": "9876500000",
        "age": "24",
        "participant_type": "Student",
        "discovery_source": "Instagram",
        "discovery_other": None,
        "payment_reference": None,
    }


def test_registration_then_proof_upload_reaches_proof_submitted(client):
    email = _unique_email()
    create_resp = client.post("/registrations", json=_payload(email))
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    assert created["registration"]["status"] == "awaiting_payment"
    reg_id = created["registration"]["id"]

    proof_resp = client.post(
        f"/registrations/{reg_id}/proof",
        data={"payment_reference": "UTR123456789"},
        files={"proof": ("proof.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png")},
    )
    assert proof_resp.status_code == 200, proof_resp.text
    body = proof_resp.json()
    assert body["registration"]["status"] == "proof_submitted"
    assert body["registration"]["payment_reference"] == "UTR123456789"

    # Confirm attendee can poll their own status by id.
    get_resp = client.get(f"/registrations/{reg_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "proof_submitted"


def test_proof_upload_rejects_disallowed_file_type(client):
    email = _unique_email()
    created = client.post("/registrations", json=_payload(email)).json()
    reg_id = created["registration"]["id"]

    bad_resp = client.post(
        f"/registrations/{reg_id}/proof",
        data={"payment_reference": "UTR000"},
        files={"proof": ("proof.txt", b"not-an-image", "text/plain")},
    )
    assert bad_resp.status_code == 400, bad_resp.text
