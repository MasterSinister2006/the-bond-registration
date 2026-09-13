from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


RegistrationStatus = Literal["awaiting_payment", "proof_submitted", "paid", "rejected"]


class RegistrationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=25)
    age: str = Field(min_length=1, max_length=3)
    participant_type: Literal["Student", "Working Professional", "Other"]
    discovery_source: Literal["Instagram", "WhatsApp", "Friends", "Colleagues", "Others"]
    discovery_other: str | None = Field(default=None, max_length=120)
    payment_reference: str | None = Field(default=None, max_length=80)


class IntegrationStatuses(BaseModel):
    google_sheets: str
    google_calendar: str
    email: str


class Registration(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: str
    age: str
    participant_type: str
    discovery_source: str
    discovery_other: str | None = None
    payment_reference: str | None = None
    status: RegistrationStatus
    created_at: datetime
    approved_at: datetime | None = None
    integration_statuses: IntegrationStatuses


class RegistrationCreated(BaseModel):
    registration: Registration
    next_step: str


class ProofSubmitted(BaseModel):
    registration: Registration
    next_step: str


class ApprovalResponse(BaseModel):
    registration: Registration
    message: str