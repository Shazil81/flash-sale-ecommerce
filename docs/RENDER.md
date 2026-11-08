# Render backend deployment

## Fix: No module named 'your_application'

This repository's Django project is `core`, and its WSGI callable is `core.wsgi:application`. `your_application` is a placeholder and is not a module in this project.

For your existing Render Web Service, open Settings → Build & Deploy and configure:

| Setting | Value |
|---|---|
| Branch | `main` |
| Root Directory | `ecommerce-backend` |
| Build Command | `bash build.sh` |
| Start Command | `bash start.sh` |

Alternatively, with the same root directory, the direct start command is:

```bash
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
```

If Root Directory is left empty, use `bash ecommerce-backend/build.sh` and `bash ecommerce-backend/start.sh` instead. The scripts resolve their own working directory.

Save the settings, then select Manual Deploy → Deploy latest commit. Pushing a startup script does not replace a Start Command already saved in the Render dashboard.

## Environment variables

Set these in Render's Environment page before deploying:

```text
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<new strong random secret>
DB_NAME=<cloud PostgreSQL database>
DB_USER=<cloud PostgreSQL user>
DB_PASSWORD=<cloud PostgreSQL password>
DB_HOST=<cloud PostgreSQL host>
DB_PORT=5432
PGSSLMODE=require
REDIS_URL=<cloud Redis rediss:// URL>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
RAZORPAY_KEY_ID=<new Razorpay test key>
RAZORPAY_KEY_SECRET=<new Razorpay test secret>
RAZORPAY_WEBHOOK_SECRET=<separate strong secret shared with Razorpay webhook settings>
```

Do not set `DB_ENGINE=sqlite` for the PostgreSQL deployment. Localhost PostgreSQL/Redis addresses point to the Render instance, not your computer; use cloud service addresses. The automatically supplied `RENDER_EXTERNAL_HOSTNAME` is accepted by Django, and HTTPS proxy handling is enabled only on Render.

The original traceback fails before Django settings or database initialization, so it does not demonstrate a database, Redis, or Python-version problem. After correcting the start command, any new traceback must be evaluated separately.

Reference: [Render's Django deployment guide](https://render.com/docs/deploy-django).

## Payment recovery after this update

The build script must run `python manage.py migrate --noinput` to apply migration `0007` before starting the updated backend. It adds payment/refund states and backfills previously fulfilled payments; it does not change catalog data.

In Razorpay Test Mode, configure a webhook pointing to `https://<backend-domain>/api/payment/webhook/`, using the same secret as `RAZORPAY_WEBHOOK_SECRET`. Subscribe to `payment.captured`, `order.paid`, `refund.processed`, and `refund.failed`. Keep the secret only in Render and Razorpay, never in Vercel's `VITE_*` variables.

Customers can recover an interrupted callback using Check payment status in the cart, or Check status under Payment updates on Orders. For unattended recovery, schedule the following in a process with the backend's database and Razorpay environment:

```bash
python manage.py reconcile_payments --limit 50
```

Run it periodically and monitor errors. The command processes the oldest unresolved records first; increase the limit or archive abandoned unpaid checkouts if they outnumber a run's batch. A provider refund failure requires operator investigation. These integrations are covered with provider mocks locally; verify the configured webhook and a refund using Razorpay Test Mode after deployment.
