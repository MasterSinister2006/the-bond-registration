import asyncio
import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from lib.integrations import dispatch_registration_sheet, dispatch_post_approval, _update_sheet_row
from lib.store import find_and_update, get_registration, insert_registration, list_registrations, update_registration
from models.registration import (
    ApprovalResponse,
    IntegrationStatuses,
    ProofSubmitted,
    Registration,
    RegistrationCreate,
    RegistrationCreated,
)

router = APIRouter()
MAX_PROOF_BYTES = 5 * 1024 * 1024
ALLOWED_PROOF_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MOCKED_INTEGRATIONS = IntegrationStatuses(
    google_sheets="MOCKED — ready for Sheet credentials",
    google_calendar="MOCKED — ready for Calendar credentials",
    email="MOCKED — preview only",
)


def _utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _registration(doc: dict) -> Registration:
    return Registration(
        id=doc["id"],
        full_name=doc["full_name"],
        email=doc["email"],
        phone=doc["phone"],
        age=doc["age"],
        participant_type=doc["participant_type"],
        discovery_source=doc["discovery_source"],
        discovery_other=doc.get("discovery_other"),
        payment_reference=doc.get("payment_reference"),
        status=doc["status"],
        created_at=_utc(doc["created_at"]),
        approved_at=_utc(doc.get("approved_at")),
        integration_statuses=IntegrationStatuses(**doc.get("integration_statuses", MOCKED_INTEGRATIONS.model_dump())),
    )


def _require_admin(pin: str | None) -> None:
    expected = os.environ.get("ADMIN_PIN", "")
    if not expected or not pin or not secrets.compare_digest(pin, expected):
        raise HTTPException(status_code=401, detail="Incorrect organizer PIN")


@router.post("/registrations", response_model=RegistrationCreated)
async def create_registration(input: RegistrationCreate) -> RegistrationCreated:
    if input.discovery_source == "Others" and not input.discovery_other:
        raise HTTPException(status_code=422, detail="Please tell us how you heard about The Bond")

    now = datetime.now(timezone.utc)
    doc = {
        **input.model_dump(),
        "id": secrets.token_hex(12),
        "status": "awaiting_payment",
        "created_at": now,
        "approved_at": None,
        "integration_statuses": MOCKED_INTEGRATIONS.model_dump(),
    }
    await insert_registration(doc)

    # Registration is written to the Google Sheet immediately. A Sheet outage does
    # not block the form response; it is surfaced as a status instead.
    sheet_status, sheet_row = await dispatch_registration_sheet(doc)
    statuses = {**MOCKED_INTEGRATIONS.model_dump(), "google_sheets": sheet_status}
    doc["integration_statuses"] = statuses
    if sheet_row is not None:
        doc["google_sheet_row"] = sheet_row
    await update_registration(doc["id"], {"integration_statuses": statuses, "google_sheet_row": sheet_row})

    return RegistrationCreated(
        registration=_registration(doc),
        next_step="Tap the UPI payment button, then upload your payment screenshot so the organizer can verify your booking.",
    )


@router.get("/registrations/{registration_id}", response_model=Registration)
async def get_registration_route(registration_id: str) -> Registration:
    doc = await get_registration(registration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Registration not found")
    return _registration(doc)


@router.post("/registrations/{registration_id}/proof", response_model=ProofSubmitted)
async def submit_payment_proof(
    registration_id: str,
    payment_reference: str = Form(..., min_length=4, max_length=80),
    proof: UploadFile = File(...),
) -> ProofSubmitted:
    if proof.content_type not in ALLOWED_PROOF_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG or PDF payment screenshot")
    content = await proof.read()
    if len(content) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=413, detail="Payment screenshot must be 5 MB or smaller")

    doc = await get_registration(registration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Registration not found")
    if doc["status"] == "paid":
        raise HTTPException(status_code=409, detail="This registration is already approved")

    updated = await find_and_update(
        registration_id,
        lambda item: item["status"] in {"awaiting_payment", "rejected"},
        {
            "status": "proof_submitted",
            "payment_reference": payment_reference,
            "proof_filename": (proof.filename or "payment-proof")[:120],
            "proof_content_type": proof.content_type,
            "proof_data": content,
        },
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Payment proof is already under review")

    # Keep the existing Sheet row current with the submitted UTR and status.
    row = updated.get("google_sheet_row")
    if row and updated.get("integration_statuses", {}).get("google_sheets") == "SYNCED":
        try:
            await asyncio.to_thread(_update_sheet_row, updated, int(row))
        except Exception:
            pass

    return ProofSubmitted(
        registration=_registration(updated),
        next_step="Your proof is queued for organizer review. Your invitation confirmation appears here after approval.",
    )


@router.get("/admin/registrations", response_model=list[Registration])
async def list_registrations_route(x_admin_pin: str | None = Header(default=None, alias="X-Admin-Pin")) -> list[Registration]:
    _require_admin(x_admin_pin)
    docs = await list_registrations()
    return [_registration(doc) for doc in docs]


@router.post("/admin/registrations/{registration_id}/approve", response_model=ApprovalResponse)
async def approve_registration(
    registration_id: str,
    x_admin_pin: str | None = Header(default=None, alias="X-Admin-Pin"),
) -> ApprovalResponse:
    _require_admin(x_admin_pin)
    now = datetime.now(timezone.utc)
    updated = await find_and_update(
        registration_id,
        lambda item: item["status"] == "proof_submitted",
        {"status": "paid", "approved_at": now},
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Only payment proofs awaiting review can be approved")

    # Email/Calendar stay optional. Sheets remain active when configured.
    integration_statuses = await dispatch_post_approval(updated)
    sheet_status = updated.get("integration_statuses", {}).get("google_sheets", "MOCKED — add Sheet credentials")
    sheet_row = updated.get("google_sheet_row")
    if sheet_row and sheet_status == "SYNCED":
        try:
            await asyncio.to_thread(_update_sheet_row, updated, int(sheet_row))
        except Exception:
            sheet_status = "FAILED — check hosting configuration"

    updated_statuses = {
        "google_sheets": sheet_status,
        "google_calendar": integration_statuses.google_calendar,
        "email": integration_statuses.email,
    }
    updated = await update_registration(registration_id, {"integration_statuses": updated_statuses}) or updated
    return ApprovalResponse(
        registration=_registration(updated),
        message="Approved. The existing Google Sheets row has been updated; optional email and Calendar integrations remain disabled unless configured.",
    )
