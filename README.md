# Ramanicave - Construction Plans Marketplace

Professional construction plans marketplace platform connecting designers with customers.

## 🏗️ Features

- **User Authentication**: JWT-based auth with role-based access control (Admin, Designer, Customer)
- **Plan Upload**: Comprehensive 8-step upload form for multi-discipline construction plans
- **Marketplace**: Browse, filter, and search professional construction plans
- **Admin Dashboard**: User management, analytics, and platform oversight
- **Designer Tools**: Upload, manage, and monetize construction plans
- **Contact System**: Built-in contact form for customer support

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: TailwindCSS v3
- **Routing**: React Router DOM v6
- **Icons**: Lucide React
- **HTTP Client**: Axios

### Backend
- **Framework**: Flask 2.3.3
- **Database**: PostgreSQL
- **Authentication**: Flask-JWT-Extended
- **Password**: Flask-Bcrypt
- **CORS**: Flask-CORS
- **API Docs**: Flasgger (Swagger)

## 📋 Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## 🚀 Local Setup

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/plancave.git
cd plancave
```

### 2. Database Setup
```bash
# Create database
sudo -u postgres psql
CREATE DATABASE plancave;
\q

# Run migrations
psql -U postgres -d plancave -f Backend/add_user_columns.sql
psql -U postgres -d plancave -f Backend/update_plans_schema.sql
```

### 3. Backend Setup
```bash
cd Backend/auth_api

# Install dependencies
pip3 install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5432/plancave
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
EOF

# Run backend
python3 app.py
```

Backend runs on `http://localhost:5000`

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env file (optional)
echo "VITE_API_URL=http://localhost:5000" > .env

# Run frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

## 📖 Documentation

- **[BACKEND.md](./BACKEND.md)** - Complete API documentation, endpoints, database schema
- **[FRONTEND.md](./FRONTEND.md)** - Frontend architecture, components, routing

## 🎨 Key Features

### Plan Upload System
- 8-step comprehensive form
- Multi-discipline support (Architectural, Structural, MEP, Civil, Fire Safety, Interior)
- BOQ (Bill of Quantities) integration
- Package levels: Basic, Standard, Premium, Complete
- File uploads with validation

### Browse & Filter
- Advanced search and filtering
- Project type filtering
- Package level filtering
- Price range filtering
- BOQ availability filter

### Admin Features
- User management with activation/deactivation
- Designer revenue analytics
- Customer purchase analytics
- Plan management
- Role assignment

### Session Management
- Auto-logout after 30 minutes of inactivity
- Token expiry checking
- Activity tracking
- Session refresh on user activity

## 🔒 Security

- JWT token authentication
- Password hashing with bcrypt
- Role-based access control
- Protected routes
- Input validation
- CORS configuration

## 📞 Contact Information

- **Email**: admin@ramanicave.com
- **Phone**: +254 741 076 621
- **Address**: Karen Watermark Business Center
- **Hours**: Monday-Friday, 8AM-6PM EAT

## 🚢 Deployment

### Recommended: Render

**Backend + Database:**
- Deploy Flask app to Render Web Service
- Use Render PostgreSQL (free tier)

**Frontend:**
- Deploy to Netlify or Render Static Site

See deployment guides in documentation files.

## 📝 License

Proprietary - All rights reserved

## 👥 Team

Built for professional construction documentation management.

---

**Status**: ✅ Production Ready
