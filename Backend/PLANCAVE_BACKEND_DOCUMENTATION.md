# PlanCave Backend - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Endpoints](#api-endpoints)
6. [Role Permissions](#role-permissions)
7. [Setup Guide](#setup-guide)
8. [Testing](#testing)

---

## Overview

PlanCave is a marketplace platform for architectural and structural designs where:
- **Designers/Architects** upload and sell plans
- **Customers** browse, purchase, and review plans
- **Admins** manage the entire platform

### Core Features
- **Pay-per-plan** purchasing system
- **Detailed uploads** with BOQs, structural specs, compliance notes
- **Team collaboration** with role-based access
- **Creator tools** with analytics dashboards
- **Local file storage** (ready for GCP migration)

---

## Interactive API Docs (Swagger)

An interactive API documentation UI is available via **Swagger (Flasgger)**.

- **URL:** `http://localhost:5000/docs/`
- **Spec URL:** `http://localhost:5000/apispec_1.json`

What you can do there:
- See a list of all registered endpoints (auth, plans, uploads, teams, creator tools, admin, customer).
- Inspect methods, paths, parameters, and response formats.
- Try requests directly from the browser (for protected endpoints, include `Authorization: Bearer <JWT>` in headers).

Swagger is initialized in `auth_api/app.py` with a global configuration so any new routes you add will automatically appear in the docs.

---

## Architecture

### File Structure
```
Backend/
├── auth/
│   └── auth_utils.py              # Unified authentication utilities
├── admin/
│   └── admin_management.py        # Admin dashboard & management
├── customer/
│   └── customer_actions.py        # Customer purchases, favorites, reviews
├── creator/
│   └── creator_tools.py           # Designer analytics & tools
├── plans/
│   ├── plans.py                   # Basic plan operations
│   └── enhanced_uploads.py        # Detailed uploads with BOQs
├── teams/
│   └── teams.py                   # Team collaboration
├── dashboards/
│   └── dashboard.py               # Role-based dashboards
├── auth_api/
│   ├── app.py                     # Main Flask application
│   ├── config.py                  # Configuration
│   └── db.sql                     # Base database schema
├── database/
│   └── migrations.sql             # Complete database migrations
└── uploads/
    └── plans/                     # Local file storage
```

### Technology Stack
- **Framework:** Flask
- **Database:** PostgreSQL
- **Authentication:** JWT (Flask-JWT-Extended)
- **Password Hashing:** Bcrypt
- **File Storage:** Local (uploads/plans/)

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'customer',  -- 'admin', 'designer', 'customer'
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    phone VARCHAR(20),
    profile_image TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Plans Table
```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    status TEXT NOT NULL,                          -- 'Available', 'Draft'
    area FLOAT NOT NULL,
    bedrooms INT NOT NULL,
    bathrooms INT NOT NULL,
    floors INT NOT NULL,
    image_url TEXT,
    designer_id INT REFERENCES users(id),
    sales_count INT DEFAULT 0,
    tags TEXT[],
    version INTEGER DEFAULT 1,
    parent_plan_id UUID REFERENCES plans(id),
    created_at TIMESTAMP NOT NULL
);
```

### Bill of Quantities (BOQs)
```sql
CREATE TABLE boqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,                     -- 'bags', 'kg', 'pieces', 'meters'
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),                         -- 'Materials', 'Labor', 'Equipment'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Structural Specifications
```sql
CREATE TABLE structural_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    spec_type VARCHAR(100) NOT NULL,               -- 'foundation', 'roofing', 'walls', 'columns'
    specification TEXT NOT NULL,
    standard VARCHAR(100),                         -- 'BS 8110', 'ACI 318', 'Eurocode'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Compliance Notes
```sql
CREATE TABLE compliance_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    authority VARCHAR(100) NOT NULL,               -- 'NEMA', 'NCA', 'County Government'
    requirement TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'compliant',        -- 'compliant', 'pending', 'not_applicable'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Plan Files
```sql
CREATE TABLE plan_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,                -- 'CAD', 'PDF', 'BIM', 'DWG', 'RVT', 'IFC'
    file_path TEXT NOT NULL,
    file_size BIGINT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Purchases
```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),                    -- 'mpesa', 'card', 'paypal'
    payment_status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    transaction_id VARCHAR(255),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);
```

### User Activity
```sql
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,           -- 'login', 'purchase', 'view', 'download', 'upload'
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Quotas
```sql
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,               -- 'downloads', 'uploads', 'storage'
    quota_limit INTEGER DEFAULT -1,                -- -1 = unlimited
    quota_used INTEGER DEFAULT 0,
    reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quota_type)
);
```

### Favorites
```sql
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_id)
);
```

### Plan Reviews
```sql
CREATE TABLE plan_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plan_id, user_id)
);
```

### Teams
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Team Members
```sql
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,                     -- 'owner', 'editor', 'viewer'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);
```

### Team Collections
```sql
CREATE TABLE team_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Collection Plans
```sql
CREATE TABLE collection_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES team_collections(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, plan_id)
);
```

### Plan Analytics
```sql
CREATE TABLE plan_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    date DATE NOT NULL,
    UNIQUE(plan_id, date)
);
```

### Plan Views
```sql
CREATE TABLE plan_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);
```

---

## Authentication & Authorization

### JWT Token Structure
```json
{
  "id": 1,
  "role": "designer",
  "username": "john_architect"
}
```

### Authentication Flow
1. User sends credentials to `/login`
2. Server validates and returns JWT token
3. Client includes token in all requests: `Authorization: Bearer <token>`
4. Server validates token and extracts user info
5. Role-based decorators enforce permissions

### Authorization Decorators

**Location:** `Backend/auth/auth_utils.py`

```python
from auth.auth_utils import require_admin, require_designer, require_role, get_current_user

# Admin only access
@app.route('/admin/users')
@jwt_required()
@require_admin
def manage_users():
    pass

# Designer or Admin access
@app.route('/plans/upload')
@jwt_required()
@require_designer
def upload_plan():
    pass

# Custom role requirements
@app.route('/teams/create')
@jwt_required()
@require_role('designer', 'customer')
def create_team():
    pass

# Get current user info
@app.route('/my-data')
@jwt_required()
def get_my_data():
    user_id, role = get_current_user()
```

### Helper Functions

```python
# Check plan ownership (returns True for admin or plan owner)
from auth.auth_utils import check_plan_ownership
if not check_plan_ownership(plan_id, user_id, conn):
    return jsonify(message="Access denied"), 403

# Log user activity
from auth.auth_utils import log_user_activity
log_user_activity(user_id, 'purchase', {
    'plan_id': plan_id,
    'amount': 5000
}, conn)

# Check user quota
from auth.auth_utils import check_user_quota, increment_user_quota
has_quota, remaining = check_user_quota(user_id, 'downloads', conn)
if has_quota:
    increment_user_quota(user_id, 'downloads', 1, conn)
```

---

## API Endpoints

### Authentication Endpoints

#### POST /login
Authenticate user and get JWT token.

**Request:**
```json
{
  "username": "john_architect",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /register/customer
Register a new customer.

**Request:**
```json
{
  "username": "jane_customer",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "message": "Customer registered",
  "user_id": 5
}
```

#### POST /register/designer
Register a new designer.

**Request:**
```json
{
  "username": "john_architect",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "message": "Designer registered",
  "user_id": 6
}
```

#### POST /admin/create_user
Admin creates user with any role.

**Auth Required:** Admin only

**Request:**
```json
{
  "username": "new_admin",
  "password": "securepass123",
  "role": "admin"
}
```

---

### Admin Endpoints

#### GET /admin/dashboard
Get comprehensive platform analytics.

**Auth Required:** Admin only

**Response:**
```json
{
  "user_stats": {
    "total_users": 150,
    "customers": 120,
    "designers": 28,
    "admins": 2,
    "new_users_30d": 25,
    "active_users": 145
  },
  "plan_stats": {
    "total_plans": 500,
    "available_plans": 450,
    "draft_plans": 50,
    "total_sales": 1200,
    "avg_price": 7500.00
  },
  "revenue_stats": {
    "total_purchases": 1200,
    "total_revenue": 9000000.00,
    "avg_transaction": 7500.00,
    "revenue_30d": 1500000.00,
    "purchases_30d": 200
  },
  "activity_stats": {
    "total_activities": 5000,
    "activities_24h": 150,
    "logins": 800,
    "purchases": 200,
    "views": 4000
  },
  "top_designers": [
    {
      "id": 5,
      "username": "top_architect",
      "email": "top@example.com",
      "total_plans": 50,
      "total_sales": 300,
      "total_revenue": 2250000.00
    }
  ],
  "recent_activity": [
    {
      "id": "uuid",
      "user_id": 10,
      "username": "customer1",
      "activity_type": "purchase",
      "details": {"plan_id": "uuid", "amount": 5000},
      "created_at": "2024-01-20T10:30:00"
    }
  ]
}
```

#### GET /admin/users
List all users with filtering.

**Auth Required:** Admin only

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role (admin, designer, customer) |
| is_active | boolean | Filter by active status |
| search | string | Search username or email |
| limit | integer | Results per page (default: 50) |
| offset | integer | Pagination offset (default: 0) |

**Response:**
```json
{
  "metadata": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "returned": 50
  },
  "users": [
    {
      "id": 1,
      "username": "john_architect",
      "email": "john@example.com",
      "role": "designer",
      "created_at": "2024-01-01T00:00:00",
      "is_active": true,
      "last_login": "2024-01-20T10:00:00",
      "purchase_count": 0,
      "plan_count": 25
    }
  ]
}
```

#### GET /admin/users/:id
Get detailed user information.

**Auth Required:** Admin only

**Response:**
```json
{
  "id": 5,
  "username": "john_architect",
  "email": "john@example.com",
  "role": "designer",
  "created_at": "2024-01-01T00:00:00",
  "is_active": true,
  "last_login": "2024-01-20T10:00:00",
  "phone": "+254700000000",
  "profile_image": "/uploads/profiles/john.jpg",
  "purchases": [
    {
      "id": "uuid",
      "plan_id": "uuid",
      "plan_name": "Modern Villa",
      "amount": 10000.00,
      "purchased_at": "2024-01-15T14:30:00"
    }
  ],
  "plans": [
    {
      "id": "uuid",
      "name": "3BR Bungalow",
      "category": "Residential",
      "price": 5000.00,
      "status": "Available",
      "sales_count": 15,
      "created_at": "2024-01-10T09:00:00"
    }
  ],
  "recent_activity": [
    {
      "activity_type": "upload",
      "details": {"plan_name": "New Design"},
      "created_at": "2024-01-19T16:00:00"
    }
  ]
}
```

#### PUT /admin/users/:id
Update user information.

**Auth Required:** Admin only

**Request:**
```json
{
  "username": "new_username",
  "email": "new@example.com",
  "role": "designer",
  "is_active": true,
  "phone": "+254711111111"
}
```

**Response:**
```json
{
  "message": "User updated successfully"
}
```

#### DELETE /admin/users/:id
Deactivate a user (soft delete).

**Auth Required:** Admin only

**Response:**
```json
{
  "message": "User deactivated successfully"
}
```

#### GET /admin/plans
List all plans with filtering.

**Auth Required:** Admin only

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (Available, Draft) |
| designer_id | integer | Filter by designer |
| category | string | Filter by category |
| limit | integer | Results per page (default: 50) |
| offset | integer | Pagination offset (default: 0) |

**Response:**
```json
{
  "metadata": {
    "total": 500,
    "limit": 50,
    "offset": 0,
    "returned": 50
  },
  "plans": [
    {
      "id": "uuid",
      "name": "Modern Villa",
      "category": "Residential",
      "price": 10000.00,
      "status": "Available",
      "designer_id": 5,
      "designer_name": "john_architect",
      "sales_count": 25,
      "purchase_count": 25,
      "created_at": "2024-01-10T09:00:00"
    }
  ]
}
```

#### PUT /admin/plans/:id
Update any plan.

**Auth Required:** Admin only

**Request:**
```json
{
  "name": "Updated Plan Name",
  "description": "New description",
  "category": "Commercial",
  "price": 15000.00,
  "status": "Available",
  "area": 250.5,
  "bedrooms": 4,
  "bathrooms": 3,
  "floors": 2
}
```

**Response:**
```json
{
  "message": "Plan updated successfully"
}
```

#### DELETE /admin/plans/:id
Delete any plan.

**Auth Required:** Admin only

**Response:**
```json
{
  "message": "Plan deleted successfully"
}
```

#### GET /admin/analytics/revenue
Get revenue analytics.

**Auth Required:** Admin only

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | day, week, month (default), year |

**Response:**
```json
{
  "revenue_timeline": [
    {
      "period": "2024-01-20T00:00:00",
      "transaction_count": 15,
      "revenue": 112500.00
    }
  ],
  "revenue_by_category": [
    {
      "category": "Residential",
      "sales_count": 800,
      "revenue": 6000000.00
    }
  ],
  "top_earners": [
    {
      "id": 5,
      "username": "top_architect",
      "email": "top@example.com",
      "sales_count": 300,
      "revenue": 2250000.00
    }
  ]
}
```

#### GET /admin/analytics/platform
Get platform-wide analytics.

**Auth Required:** Admin only

**Response:**
```json
{
  "user_growth": [
    {
      "date": "2024-01-20T00:00:00",
      "new_users": 5
    }
  ],
  "engagement_timeline": [
    {
      "date": "2024-01-20T00:00:00",
      "activity_count": 150,
      "active_users": 45
    }
  ],
  "most_viewed_plans": [
    {
      "id": "uuid",
      "name": "Popular Villa",
      "price": 10000.00,
      "category": "Residential",
      "total_views": 500,
      "total_downloads": 50
    }
  ],
  "most_purchased_plans": [
    {
      "id": "uuid",
      "name": "Best Seller",
      "price": 7500.00,
      "category": "Residential",
      "purchase_count": 100,
      "total_revenue": 750000.00
    }
  ]
}
```

---

### Designer/Creator Endpoints

#### GET /creator/analytics/overview
Get analytics overview for designer's plans.

**Auth Required:** Designer or Admin

**Response:**
```json
{
  "total_plans": 25,
  "available_plans": 20,
  "draft_plans": 5,
  "total_sales": 150,
  "total_revenue": 1125000.00,
  "total_views": 5000,
  "total_downloads": 300,
  "total_favorites": 120,
  "top_plans": [
    {
      "id": "uuid",
      "name": "Modern Villa",
      "price": 10000.00,
      "sales_count": 50,
      "views": 1200,
      "downloads": 75
    }
  ]
}
```

#### GET /creator/analytics/plans/:id
Get detailed analytics for a specific plan.

**Auth Required:** Designer or Admin (must own plan)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| days | integer | Number of days (default: 30) |

**Response:**
```json
{
  "plan": {
    "id": "uuid",
    "name": "Modern Villa"
  },
  "totals": {
    "total_views": 1200,
    "total_downloads": 75,
    "total_favorites": 30
  },
  "analytics_by_date": [
    {
      "date": "2024-01-20",
      "views_count": 45,
      "downloads_count": 3,
      "favorites_count": 1
    }
  ],
  "views_timeline": [
    {
      "date": "2024-01-20",
      "view_count": 45
    }
  ]
}
```

#### GET /creator/analytics/revenue
Get revenue analytics for designer.

**Auth Required:** Designer or Admin

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | week, month (default), year |

**Response:**
```json
{
  "total_revenue": 1125000.00,
  "period": "month",
  "revenue_by_plan": [
    {
      "id": "uuid",
      "name": "Modern Villa",
      "price": 10000.00,
      "sales_count": 50,
      "total_revenue": 500000.00
    }
  ],
  "revenue_by_category": [
    {
      "category": "Residential",
      "category_revenue": 900000.00,
      "plan_count": 18
    }
  ]
}
```

#### GET /creator/plans
Get all plans created by the designer.

**Auth Required:** Designer or Admin

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| category | string | Filter by category |
| sort_by | string | created_at, price, sales_count, name |
| order | string | asc, desc (default) |
| limit | integer | Results per page (default: 20) |
| offset | integer | Pagination offset (default: 0) |

**Response:**
```json
{
  "metadata": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "returned": 20
  },
  "plans": [
    {
      "id": "uuid",
      "name": "Modern Villa",
      "category": "Residential",
      "price": 10000.00,
      "status": "Available",
      "sales_count": 50,
      "total_views": 1200,
      "total_downloads": 75,
      "created_at": "2024-01-10T09:00:00"
    }
  ]
}
```

#### POST /creator/plans/:id/track-view
Track a plan view.

**Auth Required:** None (public)

**Request:**
```json
{
  "user_id": 10
}
```

**Response:**
```json
{
  "message": "View tracked"
}
```

#### POST /creator/plans/:id/track-download
Track a plan download.

**Auth Required:** Yes

**Response:**
```json
{
  "message": "Download tracked"
}
```

#### GET /creator/plans/:id/versions
Get all versions of a plan.

**Auth Required:** Designer or Admin (must own plan)

**Response:**
```json
[
  {
    "id": "uuid-v2",
    "name": "Modern Villa",
    "version": 2,
    "parent_plan_id": "uuid-v1",
    "status": "Available",
    "created_at": "2024-01-20T00:00:00"
  },
  {
    "id": "uuid-v1",
    "name": "Modern Villa",
    "version": 1,
    "parent_plan_id": null,
    "status": "Available",
    "created_at": "2024-01-10T00:00:00"
  }
]
```

---

### Enhanced Upload Endpoints

#### POST /plans/detailed-upload
Upload a plan with comprehensive details.

**Auth Required:** Designer or Admin

**Content-Type:** multipart/form-data

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Plan name |
| description | string | No | Plan description |
| category | string | Yes | Plan category |
| price | float | No | Price (default: 0) |
| status | string | No | Status (default: Available) |
| area | float | No | Area in sqm |
| bedrooms | integer | No | Number of bedrooms |
| bathrooms | integer | No | Number of bathrooms |
| floors | integer | No | Number of floors |
| tags | string | No | Comma-separated tags |
| images | file[] | Yes | At least one image |
| files | file[] | No | CAD/PDF/BIM files |
| boqs | JSON | No | Bill of quantities |
| structural_specs | JSON | No | Structural specifications |
| compliance_notes | JSON | No | Compliance notes |

**BOQs Format:**
```json
[
  {
    "item_name": "Cement",
    "quantity": 50,
    "unit": "bags",
    "unit_cost": 850.00,
    "total_cost": 42500.00,
    "category": "Materials"
  },
  {
    "item_name": "Steel Reinforcement",
    "quantity": 500,
    "unit": "kg",
    "unit_cost": 120.00,
    "total_cost": 60000.00,
    "category": "Materials"
  }
]
```

**Structural Specs Format:**
```json
[
  {
    "spec_type": "foundation",
    "specification": "Reinforced concrete strip foundation, 600mm wide x 200mm deep",
    "standard": "BS 8110"
  },
  {
    "spec_type": "roofing",
    "specification": "Timber truss with gauge 28 iron sheets",
    "standard": "BS 5268"
  }
]
```

**Compliance Notes Format:**
```json
[
  {
    "authority": "NEMA",
    "requirement": "Environmental Impact Assessment",
    "status": "compliant",
    "notes": "Approved on 2024-01-15, Certificate No. EIA/2024/001"
  },
  {
    "authority": "County Government",
    "requirement": "Building Permit",
    "status": "pending",
    "notes": "Application submitted, awaiting approval"
  }
]
```

**Response:**
```json
{
  "message": "Plan uploaded successfully with detailed information",
  "plan_id": "uuid",
  "images": 3,
  "files": 2,
  "boqs": 15,
  "structural_specs": 5,
  "compliance_notes": 3
}
```

#### POST /plans/bulk-upload
Bulk upload multiple plans.

**Auth Required:** Designer or Admin

**Request:**
```json
[
  {
    "name": "Plan 1",
    "description": "Description for plan 1",
    "category": "Residential",
    "price": 5000,
    "status": "Draft",
    "area": 150,
    "bedrooms": 3,
    "bathrooms": 2,
    "floors": 1,
    "tags": ["modern", "affordable"]
  },
  {
    "name": "Plan 2",
    "description": "Description for plan 2",
    "category": "Commercial",
    "price": 25000,
    "status": "Draft",
    "area": 500,
    "bedrooms": 0,
    "bathrooms": 4,
    "floors": 3,
    "tags": ["office", "modern"]
  }
]
```

**Response:**
```json
{
  "message": "Bulk upload completed",
  "uploaded": 10,
  "failed": 2,
  "uploaded_ids": ["uuid1", "uuid2", "uuid3"],
  "failures": [
    {
      "index": 5,
      "error": "Missing required field: name",
      "plan": "Unknown"
    }
  ]
}
```

#### GET /plans/:id/details
Get complete plan details with all associated data.

**Auth Required:** None (public)

**Response:**
```json
{
  "id": "uuid",
  "name": "Modern Villa",
  "description": "A beautiful 4-bedroom modern villa",
  "category": "Residential",
  "price": 10000.00,
  "status": "Available",
  "area": 250.5,
  "bedrooms": 4,
  "bathrooms": 3,
  "floors": 2,
  "image_url": "/uploads/plans/uuid/images/main.jpg",
  "designer_id": 5,
  "designer_name": "john_architect",
  "sales_count": 50,
  "tags": ["modern", "luxury", "villa"],
  "version": 1,
  "created_at": "2024-01-10T09:00:00",
  "boqs": [
    {
      "id": "uuid",
      "item_name": "Cement",
      "quantity": 50.00,
      "unit": "bags",
      "unit_cost": 850.00,
      "total_cost": 42500.00,
      "category": "Materials"
    }
  ],
  "structural_specs": [
    {
      "id": "uuid",
      "spec_type": "foundation",
      "specification": "Reinforced concrete strip foundation",
      "standard": "BS 8110"
    }
  ],
  "compliance_notes": [
    {
      "id": "uuid",
      "authority": "NEMA",
      "requirement": "Environmental Impact Assessment",
      "status": "compliant",
      "notes": "Approved on 2024-01-15"
    }
  ],
  "files": [
    {
      "id": "uuid",
      "file_name": "floor_plan.dwg",
      "file_type": "DWG",
      "file_path": "/uploads/plans/uuid/files/floor_plan.dwg",
      "file_size": 2500000
    }
  ]
}
```

#### POST /plans/:id/version
Create a new version of an existing plan.

**Auth Required:** Designer or Admin (must own plan)

**Response:**
```json
{
  "message": "New plan version created",
  "plan_id": "new-uuid",
  "version": 2,
  "parent_plan_id": "original-uuid"
}
```

---

### Customer Endpoints

#### POST /customer/plans/purchase
Purchase a plan.

**Auth Required:** Yes

**Request:**
```json
{
  "plan_id": "uuid",
  "payment_method": "mpesa"
}
```

**Response:**
```json
{
  "message": "Purchase successful",
  "purchase_id": "uuid",
  "transaction_id": "TXN-ABC123DEF456",
  "amount": 10000.00
}
```

#### GET /customer/purchases
Get purchase history.

**Auth Required:** Yes

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | integer | Results per page (default: 20) |
| offset | integer | Pagination offset (default: 0) |

**Response:**
```json
{
  "metadata": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "returned": 15
  },
  "purchases": [
    {
      "id": "uuid",
      "plan_id": "uuid",
      "plan_name": "Modern Villa",
      "category": "Residential",
      "image_url": "/uploads/plans/uuid/images/main.jpg",
      "designer_name": "john_architect",
      "amount": 10000.00,
      "payment_method": "mpesa",
      "payment_status": "completed",
      "transaction_id": "TXN-ABC123DEF456",
      "purchased_at": "2024-01-15T14:30:00"
    }
  ]
}
```

#### POST /customer/favorites
Add a plan to favorites.

**Auth Required:** Yes

**Request:**
```json
{
  "plan_id": "uuid"
}
```

**Response:**
```json
{
  "message": "Added to favorites"
}
```

#### GET /customer/favorites
Get favorite plans.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "added_at": "2024-01-18T10:00:00",
    "id": "uuid",
    "name": "Modern Villa",
    "category": "Residential",
    "price": 10000.00,
    "image_url": "/uploads/plans/uuid/images/main.jpg",
    "designer_name": "john_architect",
    "sales_count": 50
  }
]
```

#### DELETE /customer/favorites/:plan_id
Remove a plan from favorites.

**Auth Required:** Yes

**Response:**
```json
{
  "message": "Removed from favorites"
}
```

#### POST /customer/reviews
Add or update a review.

**Auth Required:** Yes (must have purchased the plan)

**Request:**
```json
{
  "plan_id": "uuid",
  "rating": 5,
  "review": "Excellent design! Very detailed and professional."
}
```

**Response:**
```json
{
  "message": "Review added successfully"
}
```

#### GET /customer/dashboard
Get customer dashboard.

**Auth Required:** Yes

**Response:**
```json
{
  "purchase_summary": {
    "total_purchases": 15,
    "total_spent": 125000.00
  },
  "favorites_count": 8,
  "recent_purchases": [
    {
      "id": "uuid",
      "purchased_at": "2024-01-15T14:30:00",
      "amount": 10000.00,
      "plan_name": "Modern Villa",
      "category": "Residential",
      "image_url": "/uploads/plans/uuid/images/main.jpg"
    }
  ],
  "recommended_plans": [
    {
      "id": "uuid",
      "name": "Similar Villa Design",
      "category": "Residential",
      "price": 12000.00,
      "sales_count": 30
    }
  ]
}
```

#### GET /customer/profile
Get user profile.

**Auth Required:** Yes

**Response:**
```json
{
  "id": 10,
  "username": "jane_customer",
  "email": "jane@example.com",
  "role": "customer",
  "created_at": "2024-01-01T00:00:00",
  "phone": "+254700000000",
  "profile_image": "/uploads/profiles/jane.jpg"
}
```

#### PUT /customer/profile
Update user profile.

**Auth Required:** Yes

**Request:**
```json
{
  "email": "newemail@example.com",
  "phone": "+254711111111",
  "profile_image": "/uploads/profiles/new_image.jpg"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully"
}
```

---

### Team Endpoints

#### POST /teams
Create a new team.

**Auth Required:** Yes

**Request:**
```json
{
  "name": "Architecture Firm Ltd",
  "description": "Our main design team"
}
```

**Response:**
```json
{
  "message": "Team created successfully",
  "team_id": "uuid"
}
```

#### GET /teams
Get all teams user is a member of.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Architecture Firm Ltd",
    "description": "Our main design team",
    "role": "owner",
    "member_count": 5,
    "owner_name": "john_architect",
    "created_at": "2024-01-01T00:00:00"
  }
]
```

#### GET /teams/:id
Get team details with members.

**Auth Required:** Yes (must be team member)

**Response:**
```json
{
  "id": "uuid",
  "name": "Architecture Firm Ltd",
  "description": "Our main design team",
  "owner_name": "john_architect",
  "created_at": "2024-01-01T00:00:00",
  "members": [
    {
      "id": 5,
      "username": "john_architect",
      "email": "john@example.com",
      "role": "owner",
      "joined_at": "2024-01-01T00:00:00"
    },
    {
      "id": 10,
      "username": "jane_designer",
      "email": "jane@example.com",
      "role": "editor",
      "joined_at": "2024-01-05T00:00:00"
    }
  ]
}
```

#### POST /teams/:id/members
Add a member to team.

**Auth Required:** Yes (Editor or Owner role required)

**Request:**
```json
{
  "user_id": 15,
  "role": "viewer"
}
```

**Response:**
```json
{
  "message": "Member added successfully"
}
```

#### DELETE /teams/:id/members/:member_id
Remove a member from team.

**Auth Required:** Yes (Owner role required)

**Response:**
```json
{
  "message": "Member removed successfully"
}
```

#### POST /teams/:id/collections
Create a collection.

**Auth Required:** Yes (Editor or Owner role required)

**Request:**
```json
{
  "name": "Hospital Projects",
  "description": "Healthcare facility designs"
}
```

**Response:**
```json
{
  "message": "Collection created successfully",
  "collection_id": "uuid"
}
```

#### GET /teams/:id/collections
Get all collections for a team.

**Auth Required:** Yes (must be team member)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Hospital Projects",
    "description": "Healthcare facility designs",
    "created_by_name": "john_architect",
    "plan_count": 12,
    "created_at": "2024-01-15T00:00:00"
  }
]
```

#### POST /teams/:id/collections/:collection_id/plans
Add a plan to collection.

**Auth Required:** Yes (Editor or Owner role required)

**Request:**
```json
{
  "plan_id": "uuid"
}
```

**Response:**
```json
{
  "message": "Plan added to collection"
}
```

#### GET /teams/:id/collections/:collection_id/plans
Get all plans in a collection.

**Auth Required:** Yes (must be team member)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "General Hospital Design",
    "category": "Healthcare",
    "price": 50000.00,
    "added_at": "2024-01-20T00:00:00",
    "added_by_name": "jane_designer"
  }
]
```

#### DELETE /teams/:id/collections/:collection_id/plans/:plan_id
Remove a plan from collection.

**Auth Required:** Yes (Editor or Owner role required)

**Response:**
```json
{
  "message": "Plan removed from collection"
}
```

---

### Public Plan Endpoints

#### GET /plans
Browse available plans.

**Auth Required:** None

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search by name |
| category | string | Filter by category |
| bedrooms | integer | Filter by bedrooms |
| min_price | float | Minimum price |
| max_price | float | Maximum price |
| sort_by | string | price, sales_count, created_at (default) |
| order | string | asc, desc (default) |
| limit | integer | Results per page (default: 10) |
| offset | integer | Pagination offset (default: 0) |

**Response:**
```json
{
  "metadata": {
    "total": 450,
    "limit": 10,
    "offset": 0,
    "returned": 10,
    "sort_by": "created_at",
    "order": "DESC"
  },
  "results": [
    {
      "id": "uuid",
      "name": "Modern Villa",
      "category": "Residential",
      "price": 10000.00,
      "area": 250.5,
      "bedrooms": 4,
      "bathrooms": 3,
      "floors": 2,
      "sales_count": 50,
      "image_url": "/uploads/plans/uuid/images/main.jpg",
      "created_at": "2024-01-10T09:00:00"
    }
  ]
}
```

---

## Role Permissions

### Permission Matrix

| Feature | Admin | Designer | Customer |
|---------|:-----:|:--------:|:--------:|
| **User Management** |
| View all users | ✅ | ❌ | ❌ |
| Update any user | ✅ | ❌ | ❌ |
| Deactivate users | ✅ | ❌ | ❌ |
| View own profile | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| **Plan Management** |
| Upload plans | ✅ | ✅ | ❌ |
| Bulk upload | ✅ | ✅ | ❌ |
| View all plans | ✅ | Own only | Public only |
| Edit any plan | ✅ | Own only | ❌ |
| Delete any plan | ✅ | Own only | ❌ |
| Create versions | ✅ | ✅ | ❌ |
| **Analytics** |
| Platform analytics | ✅ | ❌ | ❌ |
| All revenue data | ✅ | ❌ | ❌ |
| Own plan analytics | ✅ | ✅ | ❌ |
| User growth metrics | ✅ | ❌ | ❌ |
| **Commerce** |
| Purchase plans | ✅ | ✅ | ✅ |
| View own purchases | ✅ | ✅ | ✅ |
| Add favorites | ✅ | ✅ | ✅ |
| Write reviews | ✅ | ✅ | ✅ |
| **Teams** |
| Create teams | ✅ | ✅ | ✅ |
| Manage own teams | ✅ | ✅ | ✅ |
| Join teams | ✅ | ✅ | ✅ |

### Team Role Permissions

| Action | Viewer | Editor | Owner |
|--------|:------:|:------:|:-----:|
| View team/collections | ✅ | ✅ | ✅ |
| View collection plans | ✅ | ✅ | ✅ |
| Add plans to collections | ❌ | ✅ | ✅ |
| Remove plans from collections | ❌ | ✅ | ✅ |
| Create collections | ❌ | ✅ | ✅ |
| Add members | ❌ | ✅ | ✅ |
| Remove members | ❌ | ❌ | ✅ |
| Delete team | ❌ | ❌ | ✅ |

---

## Setup Guide

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- pip (Python package manager)

### 1. Clone and Setup Environment

```bash
cd /home/cyky/PLANCAVE/Backend

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install flask flask-jwt-extended flask-bcrypt psycopg2-binary python-dotenv
```

### 2. Configure Environment Variables

Create or edit `auth_api/.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/plancave

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-key-change-in-production

# GCS Configuration (for future use)
GCS_BUCKET_NAME=plancave-uploads

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

### 3. Create Database

```bash
# Create database
createdb plancave

# Run base schema
psql -d plancave -f auth_api/db.sql

# Run migrations
psql -d plancave -f database/migrations.sql
```

### 4. Create Upload Directory

```bash
mkdir -p uploads/plans
```

### 5. Create Initial Users

```sql
-- Connect to database
psql -d plancave

-- Create admin (password should be hashed with bcrypt)
INSERT INTO users (username, password, role, email, is_active) VALUES
('admin', '$2b$12$hashedpassword', 'admin', 'admin@plancave.com', true);

-- Create test designer
INSERT INTO users (username, password, role, email, is_active) VALUES
('designer1', '$2b$12$hashedpassword', 'designer', 'designer@plancave.com', true);

-- Create test customer
INSERT INTO users (username, password, role, email, is_active) VALUES
('customer1', '$2b$12$hashedpassword', 'customer', 'customer@plancave.com', true);
```

### 6. Start the Server

```bash
cd auth_api
python3 app.py
```

Server will start at `http://localhost:5000`

---

## Testing

### Test Authentication

```bash
# Login as admin
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Save the token
TOKEN="your_jwt_token_here"
```

### Test Admin Endpoints

```bash
# Get admin dashboard
curl http://localhost:5000/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"

# List all users
curl http://localhost:5000/admin/users \
  -H "Authorization: Bearer $TOKEN"

# Get platform analytics
curl http://localhost:5000/admin/analytics/platform \
  -H "Authorization: Bearer $TOKEN"
```

### Test Designer Endpoints

```bash
# Get analytics overview
curl http://localhost:5000/creator/analytics/overview \
  -H "Authorization: Bearer $TOKEN"

# Upload a plan
curl -X POST http://localhost:5000/plans/detailed-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Plan" \
  -F "category=Residential" \
  -F "price=5000" \
  -F "area=150" \
  -F "bedrooms=3" \
  -F "bathrooms=2" \
  -F "floors=1" \
  -F "images=@test_image.jpg"
```

### Test Customer Endpoints

```bash
# Get customer dashboard
curl http://localhost:5000/customer/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Browse plans
curl http://localhost:5000/plans

# Purchase a plan
curl -X POST http://localhost:5000/customer/plans/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"PLAN_UUID","payment_method":"mpesa"}'

# Add to favorites
curl -X POST http://localhost:5000/customer/favorites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"PLAN_UUID"}'
```

### Test Team Endpoints

```bash
# Create a team
curl -X POST http://localhost:5000/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Team","description":"Test team"}'

# Get teams
curl http://localhost:5000/teams \
  -H "Authorization: Bearer $TOKEN"

# Create a collection
curl -X POST http://localhost:5000/teams/TEAM_UUID/collections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Favorites","description":"Our favorite plans"}'
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "message": "Error description",
  "error": "Detailed error message (optional)"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 500 | Internal Server Error |

---

## File Storage

### Supported File Types

**Images:**
- PNG, JPG, JPEG, GIF, WEBP

**Plan Files:**
- PDF - Portable Document Format
- DWG - AutoCAD Drawing
- DXF - Drawing Exchange Format
- RVT - Revit Project
- IFC - Industry Foundation Classes
- SKP - SketchUp
- BLEND - Blender

### Storage Structure

```
uploads/
└── plans/
    └── {plan_id}/
        ├── images/
        │   ├── {uuid}.jpg
        │   └── {uuid}.png
        └── files/
            ├── {uuid}.dwg
            ├── {uuid}.pdf
            └── {uuid}.rvt
```

---

## Security Features

1. **JWT Authentication** - Secure token-based authentication
2. **Password Hashing** - Bcrypt encryption for passwords
3. **Role-Based Access Control** - Enforced at every endpoint
4. **Ownership Verification** - Users can only modify their own resources
5. **Activity Logging** - Complete audit trail of user actions
6. **Soft Deletes** - Users deactivated, not permanently deleted
7. **Quota System** - Prevent abuse with usage limits
8. **Transaction Tracking** - Complete purchase records

---

## Future Enhancements

### Payment Gateway Integration
- Stripe/PayPal/Pesapal integration
- Webhook handling
- Refund processing

### Subscription System
- Subscription plans (Basic, Plus, Team Pack)
- Recurring billing
- Plan upgrades/downgrades

### AI Features
- Plan recommendations
- Auto-tagging
- Quality checks
- Chat assistant

### GCP Migration
- Migrate from local storage to Google Cloud Storage
- Update file paths to GCS URLs

---

## Support

For issues or questions:
1. Check this documentation
2. Review the database schema in `database/migrations.sql`
3. Check the auth utilities in `auth/auth_utils.py`
4. Review individual blueprint files for specific functionality

---

*Last Updated: December 2024*
*Version: 1.0.0*
