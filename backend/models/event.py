from pydantic import BaseModel


class EventConfig(BaseModel):
    name: str
    eyebrow: str
    description: str
    date_label: str
    time_label: str
    venue: str
    price_label: str
    price_amount: int
    currency: str
    payment_upi_id: str
    payment_name: str
    payment_qr_url: str
    included: list[str]
    instagram_url: str
    whatsapp_url: str
    countdown_iso: str