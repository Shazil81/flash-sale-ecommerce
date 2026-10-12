# Ecommerce

React/Vite storefront and Django REST API with customer, administrator, and delivery workflows.

## Local development (PowerShell)

Backend:

```powershell
cd ecommerce-backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
$env:DJANGO_DEBUG = 'true'
$env:DB_ENGINE = 'sqlite'
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

SQLite uses a separate `dev.sqlite3`; the existing database is untouched. For production use PostgreSQL, configured through the variables in `ecommerce-backend/.env.example`. That file is a reference, not an automatically loaded configuration file.

Frontend, in another terminal:

```powershell
cd ecommerce-frontend
npm ci
npm run dev
```

Visit http://localhost:5173. `VITE_API_URL` defaults to http://127.0.0.1:8000/api.

## Payments and permissions

Set new `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables on the backend and restart it. Configure automatic payment capture in Razorpay: fulfillment requires a captured payment. Missing credentials produce an explicit checkout error; there is no payment bypass.

Checkout saves item prices, quantities, customer, and address before opening the payment provider. Verification checks signature, ownership, amount, currency, and capture status. Repeated verification does not duplicate orders. Purchases are fulfilled atomically against locked stock on PostgreSQL. `/api/buy/` is disabled; use verified checkout.

Public registration permits only USER and DELIVERY. Create a trusted administrator through Django admin or a management shell by assigning a UserProfile role of ADMIN. Django superuser status and storefront ADMIN role are separate.

## Validation

```powershell
cd ecommerce-backend
$env:DJANGO_DEBUG = 'true'
.\venv\Scripts\python.exe manage.py test store --settings=core.test_settings
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Frontend: `npm run lint` and `npm run build`.

Tests use a disposable in-memory database and mocked payment provider, never a real charge. Repeat concurrency validation against PostgreSQL before launch; SQLite does not implement row locking.

### PostgreSQL and Redis integration tests

`core.integration_settings` defaults to an isolated PostgreSQL cluster on port 55432, user `integration_test`. It creates and drops a uniquely named test database. Override `INTEGRATION_DB_HOST`, `INTEGRATION_DB_PORT`, `INTEGRATION_DB_USER`, and `INTEGRATION_DB_PASSWORD` for another dedicated test server with permission to create databases.

```powershell
cd ecommerce-backend
$env:DJANGO_DEBUG = 'true'
$env:INTEGRATION_REDIS_URL = 'redis://127.0.0.1:6379/15'
.\venv\Scripts\python.exe manage.py test store --settings=core.integration_settings --noinput
```

Redis tests use a unique cache-key prefix and never flush the Redis database. They verify expiry, catalog cache hits without SQL queries, and cache invalidation after successful checkout. PostgreSQL tests run concurrent requests on separate connections: 12 buyers compete for 5 units over 5 rounds, and 8 simultaneous callbacks verify the same payment. Razorpay is mocked in these automated tests; they do not verify real payment capture or browser behavior. Without PostgreSQL/Redis, the relevant integration tests skip explicitly.

See [the verification report](../VERIFICATION.md) for executed checks and remaining prerequisites.

## Deployment and remaining work

Rotate all previously exposed Django, database, and Razorpay secrets. Set `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, explicit allowed hosts/origins, PostgreSQL credentials, and real SMTP settings. Apply migrations and collect static assets before serving behind HTTPS.

Stock is checked at fulfillment, not reserved before payment. If another purchase consumes the stock, checkout returns an explicit support/refund-required response without creating partial orders. Automated refunds, payment webhooks/reconciliation, abandoned checkout expiry, grouped order presentation, and server-side pagination remain future work. Historical orders retain nullable purchase prices because their original prices cannot be reconstructed reliably.
