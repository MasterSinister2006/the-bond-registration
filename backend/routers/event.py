import os

from fastapi import APIRouter

from models.event import EventConfig

router = APIRouter()


EVENT = EventConfig(
    name="THE BOND",
    eyebrow="Tote Bag Bedazzling Party",
    description=(
        "A creative evening to design, decorate and bedazzle your own tote bag — "
        "with good vibes, new connections and a little sparkle."
    ),
    date_label="Thursday, 17 September 2026",
    time_label="5:30 PM — 7:30 PM",
    venue="Sayaji Bagh, Vadodara",
    price_label="₹359",
    price_amount=359,
    currency="INR",
    payment_upi_id=os.environ.get("PAYMENT_UPI_ID", "shah.parshva2007@oksbi"),
    payment_name=os.environ.get("PAYMENT_NAME", "Parshva Shah"),
    # Served from the frontend's own public/ folder (frontend/public/payment-qr.jpg) so
    # the QR does not depend on a third-party asset host that may disappear later.
    # Override with a full URL via PAYMENT_QR_URL if you'd rather host it elsewhere.
    payment_qr_url=os.environ.get("PAYMENT_QR_URL", "/payment-qr.jpg"),
    included=[
        "Your own tote bag to customise",
        "Complimentary refreshing drink",
        "A little surprise to take home",
        "Creative community and connection",
        "Content-worthy photo moments",
    ],
    instagram_url="https://www.instagram.com/thebondconnection_/?igshid=dWFwbzc5YTBoeDFj",
    whatsapp_url="https://chat.whatsapp.com/BfdNYpnFY1o2l7eINv1mKM?s=cl",
    countdown_iso="2026-09-17T17:30:00+05:30",
)


@router.get("/event", response_model=EventConfig)
async def get_event() -> EventConfig:
    return EVENT