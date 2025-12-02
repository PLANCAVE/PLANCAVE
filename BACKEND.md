# The Plancave - Backend Documentation

## Overview
Professional construction plans marketplace backend built with Flask, PostgreSQL, and JWT authentication.

## Technology Stack
- **Framework**: Flask 2.x (Python)
- **Database**: PostgreSQL 14+
- **Authentication**: Flask-JWT-Extended
- **Password Hashing**: Flask-Bcrypt
- **CORS**: Flask-CORS
- **API Documentation**: Flasgger (Swagger)
- **Database Driver**: psycopg2

## Architecture

### Directory Structure
```
Backend/
├── auth_api/
│   ├── app.py                 # Main authentication server
│   ├── .env                   # Environment variables
│   └── add_user_columns.sql  # Database migrations
├── admin/
│   └── admin_management.py   # Admin operations & analytics
├── plans/
│   └── plans.py              # Plan management & browsing
└── uploads/
    └── plans/                # File storage for uploaded plans
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'designer', 'customer')),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Plans Table
```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    
    -- Project Info
    project_type VARCHAR(50) DEFAULT 'Residential',
    description TEXT,
    target_audience VARCHAR(50) DEFAULT 'All',
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    
    -- Technical Specs
    area DECIMAL(10,2),
    plot_size DECIMAL(10,2),
    bedrooms INTEGER,
    bathrooms INTEGER,
    floors INTEGER NOT NULL,
    building_height DECIMAL(10,2),
    parking_spaces INTEGER DEFAULT 0,
    special_features JSONB DEFAULT '[]',
    
    -- Disciplines & Package
    disciplines_included JSONB DEFAULT '{}',
    includes_boq BOOLEAN DEFAULT FALSE,
    package_level VARCHAR(20) DEFAULT 'basic',
    
    -- Compliance
    building_code VARCHAR(100),
    certifications JSONB DEFAULT '[]',
    
    -- Licensing
    license_type VARCHAR(50) DEFAULT 'single_use',
    customization_available BOOLEAN DEFAULT FALSE,
    support_duration INTEGER DEFAULT 0,
    
    -- Costs
    estimated_cost_min DECIMAL(12,2),
    estimated_cost_max DECIMAL(12,2),
    
    -- Additional Info
    project_timeline_ref TEXT,
    material_specifications TEXT,
    construction_notes TEXT,
    
    -- Files & Media
    file_paths JSONB DEFAULT '{}',
    image_url TEXT,
    
    -- Metadata
    designer_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Available',
    sales_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Authentication API (`/` - Port 5000)

#### `POST /register`
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "first_name": "string",
  "middle_name": "string" (optional),
  "last_name": "string"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user_id": 123
}
```

#### `POST /login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Features:**
- Checks if user account is active
- Returns 403 if account deactivated
- JWT token expires in 1 hour (configurable)

### Admin API (`/admin/*`)

#### `GET /admin/dashboard`
Get admin dashboard statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "total_users": 150,
  "total_designers": 45,
  "total_customers": 105,
  "total_plans": 230,
  "revenue": 1250000
}
```

#### `GET /admin/users`
List all users with details.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "middle_name": "M",
    "last_name": "Doe",
    "role": "designer",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### `PUT /admin/users/<user_id>`
Update user details (admin only).

**Request Body:**
```json
{
  "first_name": "John",
  "middle_name": "M",
  "last_name": "Doe",
  "username": "john_doe",
  "role": "designer",
  "is_active": true
}
```

**Features:**
- Cannot delete admin users
- Cannot delete self
- Updates all user fields

#### `DELETE /admin/users/<user_id>`
Soft delete user (sets is_active to false).

**Protection:**
- Cannot delete admin role users
- Cannot delete own account

#### `GET /admin/analytics/designers`
Get designer analytics with revenue and plan counts.

**Response:**
```json
[
  {
    "designer_id": 5,
    "designer_name": "Jane Smith",
    "designer_email": "jane@example.com",
    "total_plans": 15,
    "total_revenue": 450000
  }
]
```

#### `GET /admin/analytics/customers`
Get customer analytics with purchase counts.

**Response:**
```json
[
  {
    "customer_id": 10,
    "customer_name": "Bob Johnson",
    "customer_email": "bob@example.com",
    "total_purchases": 3,
    "total_spent": 75000
  }
]
```

### Plans API (`/plans/*`)

#### `POST /plans/upload`
Upload a comprehensive professional construction plan.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**
```
name: string
project_type: string
description: string
target_audience: string
price: number
area: number
plot_size: number (optional)
bedrooms: number (optional)
bathrooms: number (optional)
floors: number
building_height: number (optional)
parking_spaces: number
special_features: JSON array
disciplines_included: JSON object
includes_boq: boolean
package_level: string (basic/standard/premium/complete)
building_code: string
certifications: JSON array
license_type: string
customization_available: boolean
support_duration: number
estimated_cost_min: number
estimated_cost_max: number
project_timeline_ref: string
material_specifications: string
construction_notes: string
```

**Files:**
- `architectural_files`: PDF/DWG/ZIP files
- `structural_files`: PDF/DWG/ZIP files
- `mep_mechanical_files`: PDF/DWG/ZIP files
- `mep_electrical_files`: PDF/DWG/ZIP files
- `mep_plumbing_files`: PDF/DWG/ZIP files
- `civil_files`: PDF/DWG/ZIP files
- `fire_safety_files`: PDF/DWG/ZIP files
- `interior_files`: PDF/DWG/ZIP/Images
- `renders`: Images/PDF
- `boq_architectural`: Excel/PDF
- `boq_structural`: Excel/PDF
- `boq_mep`: Excel/PDF
- `cost_summary`: Excel/PDF
- `thumbnail`: Image (required)
- `gallery`: Multiple images

**Response:**
```json
{
  "message": "Professional plan uploaded successfully!",
  "plan_id": "uuid",
  "disciplines": ["architectural", "structural", "mep"],
  "package_level": "premium",
  "includes_boq": true,
  "file_counts": {
    "architectural": 5,
    "structural": 3,
    "mep": 4,
    "boq": 3,
    "renders": 2,
    "gallery": 5
  }
}
```

#### `GET /plans`
Browse and filter plans.

**Query Parameters:**
- `search`: string - Search in name/description
- `project_type`: string - Filter by project type
- `package_level`: string - Filter by package level
- `includes_boq`: boolean - Filter BOQ inclusion
- `bedrooms`: number - Filter by bedroom count
- `min_price`: number - Minimum price filter
- `max_price`: number - Maximum price filter
- `sort_by`: string - Sort field (price, area, sales_count, created_at)
- `order`: string - Sort order (asc, desc)
- `limit`: number - Results per page (default: 12)
- `offset`: number - Pagination offset (default: 0)

**Response:**
```json
{
  "metadata": {
    "total": 150,
    "limit": 12,
    "offset": 0,
    "returned": 12,
    "sort_by": "created_at",
    "order": "desc"
  },
  "results": [
    {
      "id": "uuid",
      "name": "Modern 4-Bedroom Villa",
      "project_type": "Residential",
      "description": "Luxurious modern villa...",
      "package_level": "premium",
      "price": 45000,
      "area": 350,
      "bedrooms": 4,
      "bathrooms": 3,
      "floors": 2,
      "includes_boq": true,
      "disciplines_included": {
        "architectural": true,
        "structural": true,
        "mep": {"mechanical": true, "electrical": true, "plumbing": true}
      },
      "certifications": ["Energy Efficient", "Green Building"],
      "sales_count": 12,
      "image_url": "/uploads/plans/uuid/images/thumbnail.jpg",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## File Storage Structure
```
/uploads/plans/{plan_id}/
├── architectural/
│   ├── floor_plans.pdf
│   ├── elevations.pdf
│   └── sections.pdf
├── structural/
│   ├── foundation.pdf
│   └── framing.pdf
├── mep/
│   ├── mechanical/
│   ├── electrical/
│   └── plumbing/
├── civil/
├── fire_safety/
├── interior/
├── boq/
│   ├── architectural_boq.xlsx
│   ├── structural_boq.xlsx
│   └── cost_summary.pdf
├── renders/
└── images/
    ├── thumbnail.jpg
    └── gallery/
```

## Security Features

### Authentication
- JWT-based token authentication
- Tokens expire after 1 hour
- Password hashing with bcrypt (rounds: 12)

### Authorization
- Role-based access control (RBAC)
- Admin-only routes protected
- Designer-only routes protected
- Cannot delete admin users via API
- Cannot delete own account

### Session Management
- Inactivity timeout: 30 minutes
- Token expiry checking
- Active account verification on login

## Environment Variables

Create `.env` file in `Backend/auth_api/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/plancave
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
```

## Running the Backend

### Prerequisites
```bash
python3 -m pip install flask flask-cors flask-jwt-extended flask-bcrypt flasgger psycopg2-binary
```

### Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE plancave;"

# Run migrations
psql -U postgres -d plancave -f Backend/add_user_columns.sql
psql -U postgres -d plancave -f Backend/update_plans_schema.sql
```

### Start Server
```bash
cd Backend/auth_api
python3 app.py
```

Server runs on `http://localhost:5000`

## API Testing

### Swagger UI
Access API documentation at: `http://localhost:5000/apidocs`

### Example Requests

**Register:**
```bash
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"pass123","first_name":"Test","last_name":"User"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"pass123"}'
```

**Get Plans:**
```bash
curl -X GET "http://localhost:5000/plans?package_level=premium&includes_boq=true"
```

## Error Handling

Standard error responses:

```json
{
  "message": "Error description",
  "error": "Technical details (dev mode only)"
}
```

**HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Database Connection
Connection pooling is handled automatically by psycopg2. Each request opens and closes its own connection.

## Logging
All errors are logged to console. Admin analytics include detailed error logging.

## Future Enhancements
- [ ] Google Cloud Storage integration for files
- [ ] Contact form backend endpoint
- [ ] Payment integration (M-Pesa)
- [ ] Plan purchase tracking
- [ ] Email notifications
- [ ] Plan reviews and ratings
- [ ] Advanced search with Elasticsearch
