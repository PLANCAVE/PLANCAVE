# Environment Variables Setup

Add these to your `.env` file on the VPS:

```bash
# Paystack Payment Configuration
PAYSTACK_SECRET_KEY=sk_test_f61f897b4d617f01c154826e8954d9fca4bb5714
PAYSTACK_PUBLIC_KEY=pk_test_6bc288065e6d75d009d6833eb4dadc29ce92a94d
PAYSTACK_CURRENCY=USD
PAYSTACK_CALLBACK_URL=http://34.135.248.249/paystack-callback
PAYSTACK_WEBHOOK_URL=http://34.135.248.249/customer/payments/paystack/webhook

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
http://34.135.248.249/customer/payments/paystack/webhook
```

**Note:** Paystack prefers HTTPS but may accept HTTP for testing. If HTTP doesn't work:
1. Use ngrok to create HTTPS tunnel: `ngrok http 80`
2. Or set up SSL/TLS later for production
3. Manual verification (clicking "I have paid") works without webhooks

Current implementation uses manual verification, so webhooks are optional.
