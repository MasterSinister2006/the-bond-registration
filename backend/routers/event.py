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
    # NO LONGER USED BY THE PAYMENT STEP. The QR is now generated in the frontend from the
    # UPI payload and inlined into the bundle (frontend/src/components/PaymentQr.tsx),
    # because serving it as a file from public/ failed in production: it 404'd on Vercel
    # and iPhone users — who cannot follow a upi:// link at all — had no way to pay.
    # Kept only so the API response shape does not change. Setting it changes nothing.
    payment_qr_url=os.environ.get("PAYMENT_QR_URL", ""),
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