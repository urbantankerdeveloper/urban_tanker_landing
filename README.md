# Urban Tanker Operations

Modern React/Vite implementation of the Urban Tanker prototype with Firebase Authentication and Realtime Database. It covers the customer booking and tracking workflow, vendor dispatch workflow, and admin operations dashboard in one responsive application.

## ⚡ Quick Start (Firebase + Express Backend)

### Prerequisites
- **Node.js** 18+
- **Firebase Project** (free at https://console.firebase.google.com)

### Setup (5 minutes)

1. **Create Firebase Project** (if you don't have one)
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Realtime Database

2. **Get Firebase Credentials**
   - Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file

3. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env.local
   # Edit .env.local with Firebase credentials (see FIREBASE_SETUP.md)
   npm run db:init
   npm run dev
   ```

4. **Setup Frontend** (new terminal)
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev
   ```

5. **Open App**
   - Visit `http://localhost:5173`
   - Register and login!

## 📚 Documentation

- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase setup guide
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migration from PostgreSQL
- **[backend/README.md](./backend/README.md)** - Backend API documentation

## Architecture

### Authentication System

This app uses a **hybrid approach**:
- ✅ **Firebase Firestore** - Stores user data and application data
- ✅ **Express.js Backend** - RESTful API with JWT authentication
- ✅ **JWT Tokens** - Stateless authentication (7 day expiration)
- ✅ **Email/Password Login** - Standard web authentication flow
- ✅ **Role-Based Access** - Customer, Vendor, and Admin roles

```
User Registration → Bcrypt Hash → Firestore Storage
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
- Firebase Firestore integration
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
# Firebase Credentials (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed setup instructions.

## Project Structure

```
urban_tanker_landing/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── server.js          # Express app
│   │   ├── database/          # Firebase setup
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
├── FIREBASE_SETUP.md          # Firebase setup guide
├── MIGRATION_GUIDE.md         # PostgreSQL → Firestore migration
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
- **Firestore Security**: Rules-based access control
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
- Ensure Firebase credentials are correct
- Check FIREBASE_PROJECT_ID matches your Firebase project
- Run `npm run db:init` to test connection

### Frontend can't reach backend
- Ensure backend is running on port 5000
- Check VITE_API_BASE_URL in `.env.local`
- Check browser console for CORS errors

### Firebase connection fails
- Verify FIREBASE_PRIVATE_KEY has correct format with `\n`
- Check FIREBASE_CLIENT_EMAIL matches service account
- Ensure Firestore Database is enabled in Firebase Console

For detailed troubleshooting, see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

## Production Deployment

### Backend Deployment (Heroku, Railway, AWS, etc.)

1. Generate strong JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Set environment variables in your hosting platform:
   - FIREBASE_PROJECT_ID
   - FIREBASE_PRIVATE_KEY
   - FIREBASE_CLIENT_EMAIL
   - JWT_SECRET
   - CORS_ORIGIN (your frontend URL)

3. Deploy code
4. Test health endpoint

### Frontend Deployment (Vercel, Netlify, etc.)

1. Set `VITE_API_BASE_URL` to your backend URL (e.g., `https://your-api.herokuapp.com`)
2. Deploy frontend
3. Test login/registration

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed deployment instructions.

## License

See [LICENSE](./LICENSE)

---

**Next**: Read [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for complete Firebase setup instructions
