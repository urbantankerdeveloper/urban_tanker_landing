# Urban Tanker Operations

Modern React/Vite implementation of the Urban Tanker prototype with MongoDB-backed Express authentication and session-backed operations. It covers the customer booking and tracking workflow, vendor dispatch workflow, and admin operations dashboard in one responsive application.

## ⚡ Quick Start (MongoDB + Express Backend)

### Prerequisites
- **Node.js** 18+
- **MongoDB Atlas** cluster

### Setup (5 minutes)

1. **Setup MongoDB Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env.local
   # Edit .env.local with a rotated MongoDB Atlas URI
   npm run db:init
   npm run dev
   ```

2. **Setup Frontend** (new terminal)
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev
   ```

3. **Open App**
   - Visit `http://localhost:5173`
   - Register and login!

## 📚 Documentation

- **[backend/README.md](./backend/README.md)** - MongoDB backend setup and API reference
- **[backend/README.md](./backend/README.md)** - Backend API documentation

## Architecture

### Authentication System

This app uses a **hybrid approach**:
- ✅ **MongoDB** - Stores customer, vendor, and admin accounts through one role-validated `users` collection
- ✅ **Express.js Backend** - RESTful API with JWT authentication
- ✅ **JWT Tokens** - Stateless authentication (7 day expiration)
- ✅ **Email/Password Login** - Standard web authentication flow
- ✅ **Role-Based Access** - Customer, Vendor, and Admin roles

```
User Registration → Bcrypt Hash → MongoDB Storage
         ↓
    Login → Verify Password → Generate JWT
         ↓
Frontend Stores Token → Auto-Included in API Calls
         ↓
Backend Validates Token → Returns User Data
```

### Component Structure

- `src/main.tsx` - Application state and role-level routing
- `src/auth.ts` - Authentication functions (register, login, logout)
- `src/contexts/AuthContext.tsx` - Auth state management and provider
- `src/components/AppShell.tsx` - Shared top bar, navigation, and chrome
- `src/components/AuthScreen.tsx` - Login and registration UI
- `src/components/CustomerPortal.tsx` - Booking, tracking, and orders
- `src/components/VendorPortal.tsx` - Dispatch and delivery
- `src/components/AdminDashboard.tsx` - Operations and KPIs
- `src/hooks/useApi.ts` - Typed HTTP client with Zustand state
- `src/styles.scss` - Responsive design system

## Run Locally

```bash
# Development with auto-reload
npm run dev

# Type checking
npm run typecheck

# Production build
npm run build
npm start
```

The app runs on `http://localhost:5173` (development) and binds to `0.0.0.0` for network access.

## Automatic Firebase Deployment

Pushes to `main` automatically run typecheck, build the Vite app, and deploy Firebase Hosting through [`.github/workflows/firebase-hosting.yml`](.github/workflows/firebase-hosting.yml).

Add this repository secret in GitHub before the first push:

```text
FIREBASE_SERVICE_ACCOUNT_URBAN_TANKER_LANDING
```

Use a Firebase service-account JSON key for project `urban-tanker-landing` as the secret value. The workflow deploys Hosting only; deploy Realtime Database rules separately when security rules change.

## HTTP Requests

All API requests automatically include the JWT token:

```tsx
const ordersApi = useApi<Order[]>('orders');
const orders = await ordersApi.get('/orders');
await ordersApi.post('/orders', { service: 'Water tanker' });
```

The token is retrieved from localStorage and included as `Authorization: Bearer <token>`.

## API Integration

### Authentication Endpoints

```bash
# Register
POST /api/auth/register
{ email, password, displayName, phoneNumber, role }

# Login
POST /api/auth/login
{ email, password }

# Get Profile
GET /api/auth/me
(requires token)

# Update Profile
PUT /api/auth/me
{ displayName?, phoneNumber? }

# Change Password
POST /api/auth/change-password
{ currentPassword, newPassword }

# Logout
POST /api/auth/logout
```

See [backend/README.md](./backend/README.md) for complete API reference.

## Backend API

The backend runs on `http://localhost:5000` and provides:

- User authentication (register, login, profile management)
- Role-based access control (customer, vendor, admin)
- Secure password storage (bcryptjs with 10 salt rounds)
- JWT token management (7 day expiration)
- MongoDB integration for authentication and operational collections
- Request validation and error handling

See [backend/README.md](./backend/README.md) for full backend documentation.

## Environment Configuration

### Frontend (.env.local)

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:5000

# Content configuration
VITE_CONTENT_CLIENT_ID=urban-tanker
```

### Backend (backend/.env.local)

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DB_NAME=urban_tanker

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=24h

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

See [backend/README.md](./backend/README.md) for detailed setup instructions.

## Project Structure

```
urban_tanker_landing/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── server.js          # Express app
│   │   ├── database/          # MongoDB connection and initialization
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Auth middleware
│   │   └── utils/             # Helpers
│   └── package.json
│
├── src/                        # React frontend
│   ├── auth.ts                # Authentication
│   ├── components/            # UI components
│   ├── hooks/                 # Custom hooks
│   ├── types.ts               # TypeScript types
│   └── styles.scss            # Styling
│
└── package.json
```

## Features

### Customer Portal
- Browse available services
- Create bookings with details
- Track order status in real-time
- View order history
- Support and communications

### Vendor Portal
- Accept/decline orders
- Manage dispatch schedule
- Real-time delivery tracking
- Order completion and notes
- Performance analytics

### Admin Dashboard
- Operations KPIs and metrics
- Booking management and control
- User and vendor management
- System configuration
- Reports and analytics

## Security Features

- **Password Hashing**: bcryptjs with 10 salt rounds
- **JWT Tokens**: Stateless authentication with signature verification
- **MongoDB Sessions**: Hashed, expiring server-side sessions
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Email, password, and phone validation
- **Rate Limiting**: Configurable per endpoint

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Backend won't start
- Ensure MongoDB Atlas credentials and network access are correct
- Check `MONGODB_URI` and `MONGODB_DB_NAME` in `backend/.env.local`
- Run `npm run db:init` to test the connection

### Frontend can't reach backend
- Ensure backend is running on port 5000
- Check VITE_API_BASE_URL in `.env.local`
- Check browser console for CORS errors

## Production Deployment

### Backend Deployment (Heroku, Railway, AWS, etc.)

1. Generate strong JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Set environment variables in your hosting platform:
   - MONGODB_URI
   - MONGODB_DB_NAME
   - JWT_SECRET
   - CORS_ORIGIN (your frontend URL)

3. Deploy code
4. Test health endpoint

### Frontend Deployment (Vercel, Netlify, etc.)

1. Set `VITE_API_BASE_URL` to your backend URL (e.g., `https://your-api.herokuapp.com`)
2. Deploy frontend
3. Test login/registration

## License

See [LICENSE](./LICENSE)

---

**Next**: Read [backend/README.md](./backend/README.md) for backend setup and deployment instructions
