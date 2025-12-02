# Quick Database Setup

## Issue Found
The backend can't connect to PostgreSQL. Here's how to fix it:

## Option 1: Start PostgreSQL (Recommended)

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE plancave;
CREATE USER cyky WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE plancave TO cyky;
\q
EOF

# Update .env file
cd /home/cyky/PLANCAVE/Backend/auth_api
```

Edit `.env` and set:
```
DATABASE_URL=postgresql://cyky:yourpassword@localhost:5432/plancave
```

## Option 2: Use Existing PostgreSQL

If you already have PostgreSQL running on a different port or host:

```bash
cd /home/cyky/PLANCAVE/Backend/auth_api
```

Edit `.env` and update DATABASE_URL:
```
DATABASE_URL=postgresql://username:password@host:port/database
```

## After Database Setup

1. Run migrations:
```bash
cd /home/cyky/PLANCAVE/Backend
psql -d plancave -f auth_api/db.sql
psql -d plancave -f database/migrations.sql
```

2. Restart backend:
```bash
cd /home/cyky/PLANCAVE/Backend/auth_api
python3 app.py
```

3. Test registration:
```bash
curl -X POST http://localhost:5000/register/customer \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"test123456"}'
```

## Quick Fix Script

Run this to set everything up automatically:

```bash
cd /home/cyky/PLANCAVE/Backend
chmod +x quick_db_setup.sh
./quick_db_setup.sh
```
