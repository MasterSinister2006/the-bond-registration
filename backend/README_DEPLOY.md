# Backend deployment (Render)

Build command:
`pip install -r requirements.txt`

Start command:
`uvicorn server:app --host 0.0.0.0 --port $PORT`

Required environment variables:
- `CORS_ORIGINS` = your Vercel frontend URL
- `ADMIN_PIN` = your real organizer PIN
- `PAYMENT_UPI_ID` = your real UPI ID
- `PAYMENT_NAME` = your payment name
- `GOOGLE_SERVICE_ACCOUNT_JSON` = either the raw service-account JSON or the deployed credentials file path
- `GOOGLE_SHEET_ID` = your Google Sheet ID
- `GOOGLE_SHEET_RANGE` = `Registrations!A:K`

Do not add MongoDB variables. MongoDB is not required by this build.
