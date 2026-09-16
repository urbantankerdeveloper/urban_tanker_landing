# Urban Tanker Operations

Modern React/Vite implementation of the Urban Tanker prototype with production-grade database-backed authentication. It covers the customer booking and tracking workflow, vendor dispatch workflow, and admin operations dashboard in one responsive application.

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** 12+

### Setup (5 minutes)

```bash
# Windows
setup.bat

# macOS/Linux
bash setup.sh
```

Or manually:

```bash
# Backend
cd backend
npm install
cp .env.example .env.local
# Update .env.local with your database credentials
npm run db:init
npm run dev

# Frontend (in another terminal)
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173` and register/login with any email and password!

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup and deployment guide
- **[AUTH_SYSTEM.md](./AUTH_SYSTEM.md)** - Authentication system architecture and API
- **[backend/README.md](./backend/README.md)** - Backend API documentation

## Architecture

### Authentication System

This app uses a **traditional database-backed authentication system**:

- ✅ **PostgreSQL Database** - Stores users with bcrypt-hashed passwords
- ✅ **Express.js Backend** - RESTful API with JWT authentication
- ✅ **JWT Tokens** - Stateless authentication (7 day expiration)
- ✅ **Email/Password Login** - Standard web authentication flow
- ✅ **Role-Based Access** - Customer, Vendor, and Admin roles

```
Registration → Bcrypt Hash → PostgreSQL
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

See [AUTH_SYSTEM.md](./AUTH_SYSTEM.md) for complete API reference.

## Backend API

The backend runs on `http://localhost:5000` and provides:

- User authentication (register, login, profile management)
- Role-based access control (customer, vendor, admin)
- Secure password storage (bcryptjs with 10 salt rounds)
- JWT token management (7 day expiration)
- PostgreSQL database integration
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
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/urban_tanker

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Project Structure

```
urban_tanker_landing/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── server.js          # Express app
│   │   ├── database/          # PostgreSQL setup
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
├── SETUP_GUIDE.md             # Setup instructions
├── AUTH_SYSTEM.md             # Auth architecture
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
- **SQL Injection Prevention**: Parameterized queries
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
- Ensure PostgreSQL is running
- Check DATABASE_URL in `backend/.env.local`
- Run `npm run db:init` to create tables

### Frontend can't reach backend
- Ensure backend is running on port 5000
- Check VITE_API_BASE_URL in `.env.local`
- Check browser console for CORS errors

### Database connection fails
- Verify PostgreSQL is installed and running
- Check database credentials in `.env.local`
- Run `psql -U user -d urban_tanker` to test connection

For detailed troubleshooting, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).

## Production Deployment

Before deploying:
1. Generate strong JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Set NODE_ENV=production
3. Use HTTPS
4. Set up database backups
5. Enable rate limiting
6. Configure monitoring

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed deployment instructions.

## License

See [LICENSE](./LICENSE)

---

**Next**: Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions


Each deployed client sets its own `VITE_CONTENT_CLIENT_ID`; no frontend rebuild is needed when that client’s text is edited in Firestore, because active sessions receive updates in real time.

### Updating Firebase sign-in details

The `updateUserSignIn` HTTPS function accepts an authenticated `POST` request. The frontend API helper automatically adds the current Firebase ID token as a bearer token.

```ts
const accountApi = useApi('account');
await accountApi.post('/updateUserSignIn', {
	email: 'new-address@example.com',
	password: 'a-new-password-123'
});
```

Set `VITE_API_BASE_URL` to the deployed Functions base URL. Do not hash passwords in the browser or store them in Firestore. The request is protected by HTTPS, and Firebase Authentication hashes and stores the password internally. The function accepts a minimum of eight characters and allows a user to update their own account; an authenticated user with the `admin` custom claim may include another user's `uid`.

### Razorpay payments

Razorpay uses two authenticated HTTPS functions: `createRazorpayOrder` and `verifyRazorpayPayment`. The browser never receives the Razorpay secret. Before deploying Functions, create `functions/.env` from `functions/.env.example` and set the server-only values:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_server_only_secret
ALLOWED_ORIGIN=https://urban-tanker-landing.web.app
```

Deploy the payment functions with:

```sh
firebase deploy --only functions:createRazorpayOrder,functions:verifyRazorpayPayment
```

The frontend creates the Razorpay order server-side, opens Razorpay Checkout, and marks the booking as paid only after the server verifies the Razorpay HMAC signature. Cash-on-delivery remains available without Razorpay.

Firebase data lifecycle:

- The application shows an accessible loading skeleton until the first Firestore snapshot is received.
- A temporary AES-GCM encrypted cache is stored in localStorage with a five-minute TTL.
- The application decrypts and uses the cache only as a temporary startup fallback while Firebase is reconnecting.
- An expired cache triggers a Firestore refresh and the refreshed state replaces the encrypted cache.
- The encryption key is kept in sessionStorage, so the cache cannot be decrypted outside the current browser session. This protects cached content at rest from casual inspection, but it is not a substitute for server-side authorization or encryption.

## Firebase Hosting

Build with `npm run build`, then run `firebase init hosting` once for the Firebase project and deploy with `firebase deploy --only hosting`. The included `firebase.json` serves `dist` and rewrites application routes to `index.html`.

## Production handoff

This is a frontend workflow prototype. Replace the local-storage store with authenticated server APIs before deployment. Payment verification, OTP validation, role permissions, vendor links, live location, and order status transitions must be enforced server-side. See the reference handoff in the archived application for the required route and security checklist.