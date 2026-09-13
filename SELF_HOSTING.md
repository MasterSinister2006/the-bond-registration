# The Bond event form — self-hosting handoff

This project is a self-hostable FastAPI + MongoDB + Vite/React event entry form.

## Run it locally

1. Install and run MongoDB.
2. Copy `backend/.env.example` to `backend/.env` and change `ADMIN_PIN`.
3. In one terminal run `cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload`.
4. In another terminal run `cd frontend && yarn install && yarn dev --host 0.0.0.0`.
5. Open the Vite URL and use `/admin` for organizer approvals.

The production deployment should use HTTPS, a restricted CORS origin, a strong organizer PIN, MongoDB authentication, and backups.

## Important payment behavior

The form uses a UPI intent link: on a mobile device, the attendee taps **Open Google Pay / UPI app** and ₹359 is prefilled. They return with the UTR and upload a proof image/PDF. The organizer independently checks the bank/UPI statement and presses **Approve payment**, which shows the invitation confirmation and triggers the configured email flow.

This is not an automatic payment confirmation: a normal UPI link cannot securely tell a self-hosted website that money arrived. For fully automatic confirmation, use an authorized merchant/acquirer or payment provider with signed webhooks. The current UPI destination is a demo placeholder; replace it in `backend/routers/event.py` before publishing. The app never accepts card numbers, CVV, UPI PINs, or a browser-supplied “payment successful” signal.

## Real integrations

Google Sheets, Google Calendar, and confirmation email adapters are implemented but remain **MOCKED** until their server-side values are present. The admin page reports each adapter’s state. Store credentials only in `backend/.env` or a secret manager:

- Google Sheets + Calendar: create a Google Cloud project, enable **Google Sheets API** and **Google Calendar API**, create a service account, download its JSON key outside the project ZIP, and share the Sheet plus a dedicated Calendar with the service-account email. Copy the Sheet ID from the spreadsheet URL and the Calendar ID from Google Calendar settings. On a normal server, point `GOOGLE_SERVICE_ACCOUNT_FILE` at the key file's path. On Vercel or any host with no writable disk, paste the key file's entire JSON content into `GOOGLE_SERVICE_ACCOUNT_JSON` instead — either one works, `GOOGLE_SERVICE_ACCOUNT_JSON` is checked first. Also set `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE`, and `GOOGLE_CALENDAR_ID`.
- Payment QR: drop the real UPI QR image in as `frontend/public/payment-qr.jpg` (replacing the placeholder). It is served from your own deployment instead of a third-party asset link that could disappear later. To use a different filename or an external URL instead, set `PAYMENT_QR_URL`.
- Email recommendation: use a dedicated Gmail account with 2-Step Verification enabled, create a Google **App Password**, and use `smtp.gmail.com` on port `587` with STARTTLS. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `MAIL_FROM`. Never use the normal Gmail password.
- Reminder: the backend checks once per minute and sends one “✨ See you tomorrow at The Bond” email during the 24 hours before `EVENT_START`. It records `reminder_sent_at` so a confirmed attendee never receives duplicates. The worker is active only while the backend process is running and SMTP is configured.
- Never put service-account JSON, SMTP passwords, or admin secrets in the frontend or a ZIP shared publicly.

The organizer must provide these values before I can turn the adapters on: service-account JSON, Sheet ID, worksheet name/range, Calendar ID, SMTP username, Gmail app password, and the exact confirmation email subject/body.

Until those values are configured, approval remains fully usable but no real Sheet row, calendar invite, or email is sent. After configuration, each approval attempts all three actions and reports `SYNCED`, `SENT`, or a safe failure status without exposing credentials.

## Event customization

Edit the `EVENT` object in `backend/routers/event.py` for the title, venue, amount, UPI destination, links, and included items. Edit the registration models and the form fields together when adding or removing attendee questions.