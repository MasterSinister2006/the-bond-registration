# The Bond event entry form

## What it does
Public branded registration for The Bond's Tote Bag Bedazzling Party. Attendees submit required participant details, tap a fixed-amount UPI intent link, and upload a payment screenshot plus UTR. An organizer reviews the proof in a simple PIN-protected admin page. Approval shows an invitation confirmation.

## Event data
- Thursday, 17 September 2026, 5:30 PM–7:30 PM
- Sayaji Bagh, Vadodara
- Entry: ₹359 per person
- Required fields: name, email, phone, age, participant type, discovery source, optional discovery detail when Others is selected, payment reference, and payment proof

## Payment and integrations
Payment opens a fixed ₹359 UPI intent link, but confirmation remains manual because a plain UPI link cannot securely verify bank receipt. The app never accepts card details or trusts a browser payment success signal. Google Sheets, Google Calendar, and branded invitation email adapters are implemented but **MOCKED** until organizer credentials are configured. The current payment UPI ID is a demo placeholder and must be replaced before publishing.

## Key flows
1. `/` shows the landing page and registration form.
2. Registration creates `awaiting_payment`, then proof upload changes it to `proof_submitted`.
3. `/admin` accepts the organizer PIN and lists pending registrations; Approve changes the status to `paid` and shows invitation confirmation.
4. The attendee page polls their registration and reveals the invitation confirmation after approval.

## Roles
- Attendee: public form and own status by registration ID.
- Organizer: PIN-protected review page using `ADMIN_PIN` from `backend/.env`.

## Reminder
When SMTP is configured and the backend is running, a background worker sends one branded “See you tomorrow at The Bond” reminder to each `paid` attendee during the 24 hours before `EVENT_START`. `reminder_sent_at` makes the send idempotent.