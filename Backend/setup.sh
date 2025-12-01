#!/bin/bash

# PlanCave Backend Setup Script

echo "🚀 Setting up PlanCave Backend..."
echo ""

# Create uploads directory structure
echo "📁 Creating upload directories..."
mkdir -p uploads/plans
echo "✓ Upload directories created"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if psql -lqt | cut -d \| -f 1 | grep -qw plancave; then
    echo "✓ Database 'plancave' found"
else
    echo "⚠️  Database 'plancave' not found. Please create it first."
    echo "   Run: createdb plancave"
    exit 1
fi
echo ""

# Run migrations
echo "📊 Running database migrations..."
if [ -f "database/migrations.sql" ]; then
    psql -d plancave -f database/migrations.sql
    if [ $? -eq 0 ]; then
        echo "✓ Migrations completed successfully"
    else
        echo "❌ Migration failed. Please check the errors above."
        exit 1
    fi
else
    echo "⚠️  migrations.sql file not found"
    exit 1
fi
echo ""

# Check Python dependencies
echo "🐍 Checking Python dependencies..."
if python3 -c "import flask, flask_jwt_extended, flask_bcrypt, psycopg2" 2>/dev/null; then
    echo "✓ All Python dependencies are installed"
else
    echo "⚠️  Some dependencies are missing. Installing..."
    pip3 install flask flask-jwt-extended flask-bcrypt psycopg2-binary python-dotenv
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f "auth_api/.env" ]; then
    echo "📝 Creating .env file..."
    cat > auth_api/.env << 'EOL'
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/plancave

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production

# GCS Configuration (for future use)
GCS_BUCKET_NAME=plancave-uploads

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
EOL
    echo "✓ .env file created"
    echo "⚠️  Please update the DATABASE_URL and JWT_SECRET_KEY in auth_api/.env"
else
    echo "✓ .env file already exists"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update auth_api/.env with your database credentials"
echo "2. Run the backend: cd auth_api && python3 app.py"
echo "3. Test the API endpoints using the API_DOCUMENTATION.md"
echo ""
echo "📚 Documentation available at: Backend/API_DOCUMENTATION.md"
