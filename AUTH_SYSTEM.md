# Urban Tanker - Database-Backed Authentication System

## What's New

This version replaces the demo Firebase authentication with a **production-ready database-backed system** using:

- ✅ **PostgreSQL Database** - Stores user credentials securely
- ✅ **Node.js + Express Backend** - RESTful API with JWT authentication
- ✅ **Traditional Username/Password** - Email + password authentication
- ✅ **Bcrypt Hashing** - Secure password storage with bcryptjs
- ✅ **JWT Tokens** - Stateless authentication with JWTs
- ✅ **Role-Based Access** - Customer, Vendor, and Admin roles

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### 1. Setup Database

```bash
# Create database
createdb urban_tanker

# Create user
createuser urban_tanker_user
psql -U postgres -d urban_tanker -c "ALTER USER urban_tanker_user WITH PASSWORD 'SecurePassword123';"
psql -U postgres -d urban_tanker -c "GRANT ALL PRIVILEGES ON DATABASE urban_tanker TO urban_tanker_user;"
```

### 2. Start Backend

```bash
cd backend
npm install
cp .env.example .env.local
npm run db:init
npm run dev
```

### 3. Start Frontend

```bash
# In another terminal
npm install
cp .env.example .env.local
npm run dev
```

### 4. Open Application

Open `http://localhost:5173` and register/login!

---

## Architecture

### Backend Flow

```
Client Request
    ↓
[Express Middleware] (CORS, JSON parsing)
    ↓
[API Route] (e.g., /api/auth/login)
    ↓
[Password Verification] (bcrypt.compare)
    ↓
[JWT Generation] (jwt.sign)
    ↓
[Database Query] (PostgreSQL)
    ↓
[Response with Token] → Client
```

### Frontend Flow

```
User Login Form
    ↓
[Sign In Function] (src/auth.ts)
    ↓
[API Call] (POST /api/auth/login)
    ↓
[Receive Token] (JWT)
    ↓
[Store in localStorage]
    ↓
[Update Auth Context]
    ↓
[Redirect to App]
```

---

## Authentication Workflow

### User Registration

```typescript
// Frontend
const user = await registerWithPassword(
  'user@example.com',
  'password123',
  'John Doe'
);
// Returns: LocalUser with token
```

Flow:
1. User enters email, password, name
2. Frontend sends to `/api/auth/register`
3. Backend validates inputs
4. Backend hashes password with bcrypt
5. Backend stores user in PostgreSQL
6. Backend generates JWT token
7. Token is returned and stored in localStorage

### User Login

```typescript
// Frontend
const user = await signInWithPassword(
  'user@example.com',
  'password123'
);
// Returns: LocalUser with token
```

Flow:
1. User enters email and password
2. Frontend sends to `/api/auth/login`
3. Backend finds user by email
4. Backend compares password with stored hash
5. Backend generates JWT token
6. Token is returned and stored in localStorage

### Authenticated Request

```typescript
// Automatic in all API calls via useApi hook
const { data } = await api.get('/some-endpoint');
```

Flow:
1. Frontend gets token from localStorage
2. Token is included in Authorization header
3. Backend middleware validates token
4. Backend processes request
5. Response is sent to frontend

### User Logout

```typescript
// Frontend
await signOutUser();
// Clears localStorage, updates auth context
```

Flow:
1. Frontend removes token from localStorage
2. Frontend clears user from memory
3. Frontend redirects to login
4. Optional: Backend invalidates session

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) UNIQUE NOT NULL,          -- UUID for frontend
  email VARCHAR(255) UNIQUE NOT NULL,        -- Login email
  password_hash VARCHAR(255) NOT NULL,       -- Bcrypt hash
  display_name VARCHAR(255),                 -- User's name
  phone_number VARCHAR(20),                  -- Contact number
  role VARCHAR(50) NOT NULL DEFAULT 'customer',  -- Role (customer/vendor/admin)
  email_verified BOOLEAN DEFAULT FALSE,      -- Email verification status
  phone_verified BOOLEAN DEFAULT FALSE,      -- Phone verification status
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP                       -- Last login timestamp
);
```

### Sessions Table (Optional)

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500)
);
```

---

## API Endpoints

### POST `/api/auth/register`
Register a new user
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe",
  "phoneNumber": "9876543210",
  "role": "customer"
}
```

### POST `/api/auth/login`
Login with email and password
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### GET `/api/auth/me`
Get current user profile (requires token)
```
Authorization: Bearer <token>
```

### PUT `/api/auth/me`
Update user profile (requires token)
```json
{
  "displayName": "Jane Doe",
  "phoneNumber": "9876543211"
}
```

### POST `/api/auth/change-password`
Change password (requires token)
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### POST `/api/auth/logout`
Logout (requires token)

---

## Security Features

### 1. Password Hashing
- Uses bcryptjs with 10 salt rounds
- Passwords are never stored in plain text
- Each password takes time to hash (prevents brute force)

### 2. JWT Tokens
- Stateless authentication
- Tokens include user info and expiration
- Default expiration: 7 days (configurable)
- Can't be forged without secret key

### 3. SQL Injection Prevention
- Uses parameterized queries
- pg library handles escaping

### 4. CORS Protection
- Configurable allowed origins
- Only allows requests from specified domains

### 5. Input Validation
- Email validation (format check)
- Password minimum length (8 characters)
- Phone number validation (Indian format)
- Name sanitization (SQL injection prevention)

---

## Environment Configuration

### Backend (.env.local)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/urban_tanker

# JWT
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env.local)
```env
# Backend API
VITE_API_BASE_URL=http://localhost:5000

# Content
VITE_CONTENT_CLIENT_ID=urban-tanker
```

---

## File Structure

```
backend/
├── src/
│   ├── server.js              # Express app setup
│   ├── database/
│   │   ├── connection.js      # PostgreSQL connection
│   │   └── init.js            # Database initialization
│   ├── routes/
│   │   └── auth.js            # Authentication API routes
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   └── utils/
│       └── auth.js            # Password hashing, JWT
│
frontend/
├── src/
│   ├── auth.ts                # Authentication functions
│   ├── contexts/AuthContext.tsx  # Auth state management
│   ├── hooks/useApi.ts        # API requests with auth
│   └── components/AuthScreen.tsx  # Login/register UI
```

---

## Integration Guide

### Using Authentication in Components

```typescript
// Get current user
import { useAuth } from './contexts/AuthContext';

export function MyComponent() {
  const { user, loading, signOut } = useAuth();
  
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Not logged in</p>;
  
  return (
    <div>
      <p>Welcome, {user.displayName}</p>
      <p>Role: {user.role}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Making Authenticated API Calls

```typescript
// API requests automatically include token
import { useApi } from './hooks/useApi';

export function OrdersList() {
  const api = useApi<Order[]>('orders');
  
  useEffect(() => {
    api.get('/orders').then(orders => {
      console.log(orders);
    });
  }, []);
  
  return <div>Orders: {api.data?.length}</div>;
}
```

---

## Common Tasks

### Change Password Requirements

Edit `backend/src/routes/auth.js`:
```typescript
// Change minimum length
body('password').isLength({ min: 12 })  // 12 chars instead of 8
```

### Add Email Verification

Edit `backend/src/routes/auth.js`:
```typescript
// Send verification email after register
sendVerificationEmail(user.email, user.uid);
```

### Implement Refresh Tokens

Add to `backend/src/routes/auth.js`:
```typescript
// Generate refresh token
const refreshToken = jwt.sign(
  { uid: user.uid },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '30d' }
);
```

### Add Role-Based Routes

Use middleware in `backend/src/routes/`:
```typescript
import { requireRole } from '../middleware/auth';

router.get('/admin/users', requireRole(['admin']), getUsers);
```

---

## Troubleshooting

### "connect ECONNREFUSED 127.0.0.1:5432"
PostgreSQL is not running. Start it:
```bash
# macOS
brew services start postgresql@15

# Ubuntu
sudo service postgresql start

# Windows
Services → PostgreSQL → Start
```

### "password authentication failed"
Check your DATABASE_URL credentials in `.env.local`

### "jwt expired"
Token has expired. User needs to login again. Token expiration can be changed in `.env.local` with `JWT_EXPIRE`.

### "CORS error: No 'Access-Control-Allow-Origin'"
Frontend URL doesn't match CORS_ORIGIN in backend `.env.local`

---

## Production Deployment

### Before deploying:

1. **Strong JWT_SECRET**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Environment**: Set NODE_ENV=production

3. **HTTPS**: Enable SSL/TLS

4. **Database**: Use managed database service (AWS RDS, Heroku Postgres, etc.)

5. **Rate Limiting**: Add rate limiting middleware

6. **Monitoring**: Set up error tracking

### Deployment services:

- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Backend**: Heroku, Railway, AWS EC2, DigitalOcean
- **Database**: AWS RDS, Heroku Postgres, MongoDB Atlas

---

## Support

For issues or questions:
1. Check `SETUP_GUIDE.md` for detailed setup
2. Check `backend/README.md` for backend API docs
3. Review error messages in console/logs
4. Check database connection with `psql`

---

## Next Steps

- ✅ Setup complete
- 📝 Customize for your business
- 🔒 Add email/phone verification
- 📊 Integrate with payment system
- 🚀 Deploy to production
