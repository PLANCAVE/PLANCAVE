# The Plancave - Frontend Documentation

## Overview
Modern React-based frontend for The Plancave professional construction plans marketplace. Built with React 19, TypeScript, TailwindCSS, and Vite.

## Technology Stack
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 5
- **Styling**: TailwindCSS v3
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **State Management**: React Context API

## Architecture

### Directory Structure
```
frontend/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Header.tsx       # Main navigation header
│   │   └── ContactModal.tsx # Contact form modal
│   ├── pages/              # Page components
│   │   ├── Landing.tsx     # Landing page
│   │   ├── Login.tsx       # User login
│   │   ├── Register.tsx    # User registration
│   │   ├── BrowsePlans.tsx # Plan marketplace
│   │   ├── Dashboard.tsx   # User dashboard
│   │   ├── admin/         # Admin pages
│   │   │   ├── UserManagement.tsx
│   │   │   ├── PlanManagement.tsx
│   │   │   └── Analytics.tsx
│   │   └── designer/      # Designer pages
│   │       ├── UploadPlan.tsx
│   │       └── MyPlans.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx # Authentication state
│   ├── api.ts            # API client
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── tailwind.config.js   # Tailwind config
```

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Designer, Customer)
- Session management with auto-logout
- Protected routes
- 30-minute inactivity timeout

### 2. User Interface
- Responsive design (mobile-first)
- Glass-morphism effects
- Gradient accents
- Smooth animations and transitions
- Dark theme landing page
- Light theme application pages

### 3. Plan Upload System
- 8-step comprehensive form
- Multi-discipline support
- File uploads for each discipline
- BOQ integration
- Package level selection
- Real-time validation

### 4. Browse & Search
- Advanced filtering
- Project type filtering
- Package level filtering
- Price range filtering
- BOQ availability filter
- Responsive card grid
- Discipline badges

### 5. Admin Dashboard
- User management with inline editing
- Analytics for designers and customers
- Plan management
- User activation/deactivation
- Role management

## Pages Overview

### Landing Page (`/`)
**Features:**
- Hero section with 3D effects
- Feature showcase
- Statistics display
- Contact section with business info
- CTA sections
- Responsive navigation

**Contact Information:**
- Email: admin@plancave.com
- Phone: +254 741 076 621
- Address: Karen Watermark Business Center
- Business Hours: Monday-Friday, 8AM-6PM EAT

### Authentication

#### Login (`/login`)
- Email/password authentication
- Error handling
- Session creation
- Redirect to dashboard

**Error Messages:**
- Invalid credentials (401)
- Account not found (404)
- Account deactivated (403): "Your account has been deactivated. Please contact admin@plancave.com."

#### Register (`/register`)
**Fields:**
- First Name *
- Middle Name (optional)
- Last Name *
- Email Address *
- Password *
- Role Selection (Customer/Designer)

**Validation:**
- Email format
- Password strength
- Unique username

### Browse Plans (`/plans`)
**Public Page** - No authentication required

**Filters:**
- Search by name/description
- Project Type (Residential, Commercial, Industrial, Institutional, Mixed-Use)
- Package Level (Basic, Standard, Premium, Complete)
- Includes BOQ (Yes/No)
- Bedrooms (1-5+)
- Price Range (Min/Max)

**Plan Card Display:**
- Thumbnail image
- Plan name and price
- Project type
- Area, bedrooms, floors
- Discipline badges
- Package level badge
- BOQ indicator
- Certifications count
- Sales count
- Like and cart buttons (authenticated)

**Discipline Badges:**
- 📐 Architectural
- 🏗️ Structural
- ⚡ MEP
- 🛣️ Civil
- 🚨 Fire Safety
- 🎨 Interior

### Dashboard (`/dashboard`)
**Protected Route** - Requires authentication

**Role-Based Content:**

**Admin Dashboard:**
- Total statistics
- User management link
- Plan management link
- Analytics link
- Upload plans (admin has all designer rights)

**Designer Dashboard:**
- Revenue statistics
- My plans list
- Upload new plan button
- Plan performance metrics

**Customer Dashboard:**
- Purchase history
- Liked plans
- Cart items
- Browse plans link

### Admin Pages

#### User Management (`/admin/users`)
**Admin Only**

**Features:**
- User list table
- Search/filter users
- Edit user details modal
- Activate/deactivate users
- Delete users (except admins)
- Role assignment

**Edit Modal Fields:**
- First Name
- Middle Name
- Last Name
- Email
- Role (Customer/Designer/Admin)
- Active Status

**Protections:**
- Cannot delete admin users
- Cannot delete self
- Cannot modify own role

#### Analytics (`/admin/analytics`)
**Admin Only**

**Designer Analytics:**
- Designer name and email
- Total plans uploaded
- Total revenue generated
- Performance metrics

**Customer Analytics:**
- Customer name and email
- Total purchases
- Total amount spent
- Activity metrics

#### Plan Management (`/admin/plans`)
**Admin Only**

Features TBD (future implementation)

### Designer Pages

#### Upload Plan (`/designer/upload`)
**Designer & Admin Only**

**8-Step Process:**

**Step 1: Basic Information**
- Plan Name *
- Project Type * (Residential/Commercial/Industrial/Institutional/Mixed-Use)
- Target Audience (Homeowner/Contractor/Developer/Professional/All)
- Description *

**Step 2: Technical Specifications**
- Total Area (m²) *
- Plot Size (m²)
- Bedrooms
- Bathrooms
- Floors/Stories *
- Building Height (m)
- Parking Spaces
- Special Features (12 options):
  - Swimming Pool, Basement, Penthouse, Rooftop Terrace
  - Gym, Home Office, Smart Home, Solar Panels
  - Rainwater Harvesting, Elevator, Servant Quarters, Garden

**Step 3: Disciplines Included**
Select which construction disciplines are included:
- ☑️ Architectural Plans (REQUIRED)
- ☐ Structural Plans
- ☐ MEP Plans
  - Mechanical (HVAC)
  - Electrical
  - Plumbing
- ☐ Civil/Infrastructure
- ☐ Fire & Life Safety
- ☐ Interior Design Package

**Step 4: File Uploads**
Upload files for each selected discipline:
- Architectural: PDF/DWG/ZIP
- Structural: PDF/DWG/ZIP
- MEP (Mechanical/Electrical/Plumbing): PDF/DWG/ZIP
- Civil: PDF/DWG/ZIP
- Fire Safety: PDF/DWG/ZIP
- Interior: PDF/DWG/ZIP/Images
- 3D Renders: Images/PDF
- Thumbnail Image * (required)
- Gallery Images (up to 10)

**Step 5: BOQ & Cost Estimation**
- Include BOQ checkbox
- Upload Architectural BOQ (Excel/PDF)
- Upload Structural BOQ (Excel/PDF)
- Upload MEP BOQ (Excel/PDF)
- Upload Cost Summary (Excel/PDF)
- Estimated Cost Range (Min-Max in KSH)

**Step 6: Package Level & Compliance**
**Package Levels:**
- Basic: Architectural only (KSH 5K-15K)
- Standard: Arch + Structural (KSH 15K-30K)
- Premium: Arch + Struct + MEP + BOQ (KSH 30K-60K)
- Complete: Everything (KSH 60K+)

**Building Code Compliance:**
- Kenya Building Code
- IBC (International Building Code)
- Eurocode
- British Standards (BS)
- Other/Custom

**Certifications:**
- Energy Efficient
- Green Building
- LEED Certified
- Accessibility Compliant
- Fire Safety Certified
- Seismic Resistant

**Step 7: Pricing & Licensing**
- Base Price (KSH) *
- License Type:
  - Single Use (one-time construction)
  - Multiple Use (up to 5 constructions)
  - Commercial License (unlimited)
- Customization Services Available (checkbox)
- Support/Revision Duration (months)

**Step 8: Additional Information**
- Project Timeline Reference
- Material Specifications
- Construction Notes

**Progress Tracking:**
- Visual step indicators
- Current step highlighted
- Completed steps marked with checkmark

#### My Plans (`/designer/my-plans`)
**Designer & Admin Only**

Features TBD (future implementation)

## Components

### Header
**Global Navigation Component**

**Features:**
- Glass-morphism styling
- Logo with animation
- Dynamic navigation based on auth status
- Contact modal trigger
- Mobile-responsive menu

**Logged Out:**
- Browse Plans
- Contact
- Sign In
- Sign Up

**Logged In:**
- Browse Plans
- Contact
- Dashboard
- User info with status indicator
- Role badge
- Logout button

**Mobile Menu:**
- Hamburger icon
- Slide-down menu
- All navigation items
- Close button

### ContactModal
**Reusable Contact Form**

**Fields:**
- Name *
- Email *
- Phone
- Message *

**Features:**
- Modal overlay with blur
- Contact information cards (Email, Phone, Address)
- Form validation
- Loading state
- Success message
- Close button
- Responsive design

## Context API

### AuthContext
**Global Authentication State**

**State:**
- `user`: User object or null
- `token`: JWT token or null
- `isAuthenticated`: boolean
- `isAdmin`: boolean
- `isDesigner`: boolean
- `isCustomer`: boolean

**Methods:**
- `login(email, password)`: Authenticate user
- `logout(reason?)`: Clear auth state

**Features:**
- Token expiry checking (every minute)
- Inactivity timeout (30 minutes)
- Activity tracking (mouse, keyboard, scroll, touch, click)
- Session refresh on activity
- Auto-logout with alert messages
- LocalStorage persistence

**Auto-Logout Scenarios:**
1. Token expired
2. 30 minutes of inactivity
3. Manual logout

## API Integration

### API Client (`api.ts`)

**Base Configuration:**
```typescript
const API_URL = 'http://localhost:5000';
axios.defaults.baseURL = API_URL;
```

**Request Interceptor:**
- Automatically adds JWT token to headers
- Format: `Authorization: Bearer <token>`

**Response Interceptor:**
- Handles 401 errors
- Auto-logout on unauthorized

**API Functions:**

**Authentication:**
- `login(username, password)`
- `register(userData)`

**Plans:**
- `browsePlans(params)` - Get filtered plans
- `uploadPlan(formData)` - Upload new plan

**Admin:**
- `getAdminDashboard()` - Dashboard stats
- `getAllUsers()` - List all users
- `updateUser(id, data)` - Update user
- `deleteUser(id)` - Delete user
- `getDesignerAnalytics()` - Designer stats
- `getCustomerAnalytics()` - Customer stats

## Routing

### Public Routes
- `/` - Landing page
- `/plans` - Browse plans
- `/login` - Login page
- `/register` - Registration page

### Protected Routes
- `/dashboard` - User dashboard

### Admin Routes
- `/admin/users` - User management
- `/admin/plans` - Plan management
- `/admin/analytics` - Analytics

### Designer Routes
- `/designer/upload` - Upload plan
- `/designer/my-plans` - My plans

**Route Protection:**
- `ProtectedRoute`: Requires authentication
- `AdminRoute`: Requires admin role
- `DesignerRoute`: Requires designer or admin role

## Styling

### TailwindCSS Configuration

**Color Palette:**
- Primary: Teal (#2C5F5F)
- Secondary: Cyan
- Accents: Purple, Pink, Orange, Green

**Custom Classes:**
```css
.card - White background card with shadow
.btn-primary - Teal gradient button
.btn-secondary - Gray outline button
.input-field - Form input styling
```

**Design Patterns:**
- Glass-morphism (`backdrop-blur`, `bg-white/10`)
- Gradients (`bg-gradient-to-r from-teal-600 to-cyan-600`)
- Shadows with color (`shadow-2xl shadow-teal-500/50`)
- Hover animations (`hover:scale-105`, `hover:-translate-y-2`)
- Smooth transitions (`transition-all duration-300`)

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`
- Grid layouts with responsive columns
- Mobile menu for small screens

## State Management

### Local State (useState)
- Form inputs
- Modal visibility
- Loading states
- Error messages

### Context State (useContext)
- Authentication state
- User information
- Session management

### URL State (useNavigate, useParams)
- Route parameters
- Navigation state
- Query parameters

## Build & Development

### Development Server
```bash
cd frontend
npm install
npm run dev
```
Server runs on `http://localhost:5173`

### Production Build
```bash
npm run build
```
Output directory: `dist/`

### Environment Variables
Create `.env` file:
```env
VITE_API_URL=http://localhost:5000
```

### Dependencies

**Core:**
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^6.20.0",
  "typescript": "^5.3.0"
}
```

**HTTP & API:**
```json
{
  "axios": "^1.6.0"
}
```

**UI & Styling:**
```json
{
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.300.0"
}
```

**Build Tools:**
```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0"
}
```

## Testing

### Manual Testing Checklist

**Authentication:**
- [x] User registration
- [x] User login
- [x] Auto-logout on inactivity
- [x] Auto-logout on token expiry
- [x] Session refresh on activity
- [x] Deactivated user blocked

**Authorization:**
- [x] Admin can access all pages
- [x] Designer can upload plans
- [x] Customer cannot access admin pages
- [x] Protected routes redirect to login

**Plan Upload:**
- [x] All 8 steps functional
- [x] File uploads work
- [x] Multi-discipline support
- [x] BOQ upload
- [x] Form validation

**Browse Plans:**
- [x] Search functionality
- [x] Filters work correctly
- [x] Pagination
- [x] Responsive cards

**Admin Features:**
- [x] User list displays
- [x] Edit user modal works
- [x] Cannot delete admin
- [x] Analytics display correctly

## Performance Optimizations

### Code Splitting
- Route-based code splitting
- Lazy loading of pages (future)

### Image Optimization
- Responsive images
- Lazy loading images (future)

### API Optimization
- Request debouncing for search
- Caching (future)

## Security

### Client-Side Security
- No sensitive data in localStorage (only token)
- JWT token in Authorization header
- XSS protection via React
- Input sanitization
- HTTPS required in production

### Authentication Flow
1. User enters credentials
2. API validates and returns JWT
3. Token stored in localStorage
4. Token added to all API requests
5. Token validated on every request
6. Auto-logout on expiry/inactivity

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility
- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation
- Focus indicators
- Screen reader friendly

## Future Enhancements
- [ ] Plan detail page
- [ ] Shopping cart functionality
- [ ] Payment integration (M-Pesa)
- [ ] Purchase history
- [ ] Plan reviews and ratings
- [ ] Favorite/like plans
- [ ] Advanced search
- [ ] Plan comparison
- [ ] Real-time notifications
- [ ] Chatbot integration (bottom-right corner reserved)
- [ ] Dark mode toggle
- [ ] Multi-language support
