#!/bin/bash

echo "🚀 PlanCave Database Setup"
echo "=========================="
echo ""

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL is not running"
    echo "Starting PostgreSQL... (may need sudo)"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "✅ PostgreSQL started"
fi

echo ""
echo "📊 Setting up database..."
echo ""

# Create database
sudo -u postgres psql << EOF
-- Drop and recreate database (fresh start)
DROP DATABASE IF EXISTS plancave;
CREATE DATABASE plancave;

-- Create user if doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'cyky') THEN
    CREATE USER cyky WITH PASSWORD 'CaveOfPlans_92X';
  ELSE
    ALTER USER cyky WITH PASSWORD 'CaveOfPlans_92X';
  END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE plancave TO cyky;
ALTER DATABASE plancave OWNER TO cyky;

\c plancave
GRANT ALL ON SCHEMA public TO cyky;

\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully"
else
    echo "❌ Failed to create database"
    exit 1
fi

# Update .env file
echo ""
echo "📝 Updating .env file..."
cat > auth_api/.env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://cyky:CaveOfPlans_92X@localhost:5432/plancave

# JWT Configuration
JWT_SECRET_KEY=plancave-jwt-secret-key-production-2024
SECRET_KEY=plancave-secret-key-production-2024

# GCS Configuration (optional)
GCS_BUCKET_NAME=plancave-uploads
EOF
echo "✅ .env file updated"

# Run migrations
echo ""
echo "🔄 Running migrations..."
psql -U cyky -d plancave -f auth_api/db.sql
psql -U cyky -d plancave -f database/migrations.sql

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "⚠️  Some migrations may have failed, but continuing..."
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the backend:"
echo "   cd auth_api && python3 app.py"
echo ""
echo "2. Test the API:"
echo "   curl -X POST http://localhost:5000/register/customer \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"test@example.com\",\"password\":\"test123\"}'"
echo ""
