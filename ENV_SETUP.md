# Environment Variables Setup

Add these to your `.env` file on the VPS:

```bash
# Paystack Payment Configuration
PAYSTACK_SECRET_KEY=sk_test_f61f897b4d617f01c154826e8954d9fca4bb5714
PAYSTACK_PUBLIC_KEY=pk_test_6bc288065e6d75d009d6833eb4dadc29ce92a94d
PAYSTACK_CURRENCY=USD
PAYSTACK_CALLBACK_URL=https://34.135.248.249/paystack-callback
PAYSTACK_WEBHOOK_URL=https://34.135.248.249/customer/payments/paystack/webhook

# Database (existing)
DATABASE_URL=postgresql://username:password@localhost:5432/plancave

# JWT (existing)
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Download Settings (existing)
DOWNLOAD_LINK_EXPIRY_MINUTES=30
MAX_DOWNLOADS_PER_TOKEN=1

# GCS (existing, if used)
GCS_BUCKET_NAME=your-gcs-bucket-name
```

## Where to add

On your VPS:
```bash
cd /var/www/plancave
nano .env
```

Or create the file if it doesn't exist:
```bash
touch .env
nano .env
```

## After adding env vars

1. Install new dependencies:
```bash
source venv/bin/activate
pip install -r Backend/auth_api/requirements.txt
```

2. Apply database migration for quotas:
```bash
psql -d plancave -f Backend/database/migrations.sql
```

3. Restart backend services to load new env vars.

## Paystack Webhook Setup

In your Paystack dashboard, set webhook URL to:
```
https://34.135.248.249/customer/payments/paystack/webhook
```

**Important:** Paystack requires HTTPS URLs for callbacks and webhooks. You'll need to:
1. Set up SSL/TLS certificate on your VPS (Let's Encrypt recommended)
2. Configure your web server (nginx/apache) to handle HTTPS
3. Update your server configuration to redirect HTTP to HTTPS

Note: Webhook endpoint not yet implemented - you'll need to add it to handle automatic payment verification.
