# Migration from PostgreSQL to Firebase Firestore

## Summary of Changes

The Urban Tanker backend has been updated to use **Firebase Firestore** for data storage instead of PostgreSQL, while maintaining the same JWT authentication system.

### What Changed

**Backend**:
- ✅ Replaced PostgreSQL with Firebase Firestore
- ✅ Removed `pg` dependency, added `firebase-admin`
- ✅ Updated database layer to use Firestore queries
- ✅ Maintained all authentication endpoints and JWT tokens
- ✅ No database schema initialization needed (Firestore is serverless)
- ✅ Removed database connection pooling

**Frontend**:
- ✅ No changes needed! Already using backend API with JWT tokens
- ✅ Same login/registration flow
- ✅ Same user experience

**Environment Variables**:
- ❌ Removed: `DATABASE_URL` (PostgreSQL connection string)
- ✅ Added: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

## Why Firebase Firestore?

1. **No Server Management**: Firestore is fully managed by Google
2. **Automatic Scaling**: Handles traffic spikes automatically
3. **Real-time Database**: Built-in support for live data updates
4. **Offline Support**: Mobile apps can work offline (future feature)
5. **Cost Effective**: Pay only for what you use
6. **Security**: Firebase handles backups and security

## Quick Start

### 1. Get Firebase Credentials

```bash
# Go to: https://console.firebase.google.com
# Create new Firebase project or use existing one
# Download service account JSON (Settings → Service Accounts → Generate Key)
```

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env.local
# Edit .env.local with Firebase credentials
npm run db:init
npm run dev
```

### 3. Setup Frontend

```bash
cd ..
npm install
npm run dev
```

### 4. Open App

Visit `http://localhost:5173` and register/login!

## File Changes

### Backend Files Modified

| File | Change |
|------|--------|
| `package.json` | Replaced `pg` with `firebase-admin` |
| `.env.example` | Replaced DATABASE_URL with Firebase config |
| `src/database/connection.js` | Replaced PostgreSQL Pool with Firebase Admin SDK |
| `src/database/init.js` | Replaced schema creation with Firestore connection test |
| `src/routes/auth.js` | Replaced SQL queries with Firestore operations |
| `src/server.js` | Updated to use `closeConnection` instead of `closePool` |

### Files Unchanged

| File | Reason |
|------|--------|
| `src/auth.ts` | Frontend auth already calls backend API |
| `src/hooks/useApi.ts` | API hook already injects JWT tokens |
| `src/components/AuthScreen.tsx` | UI already works with backend auth |
| `src/utils/auth.js` | Password hashing and JWT still used |
| `src/middleware/auth.js` | JWT verification still needed |

## Authentication Flow

Same as before, but now data goes to Firestore:

```
1. User enters email/password
2. Frontend → POST /api/auth/login
3. Backend finds user in Firestore users collection
4. Backend compares password hash
5. Backend generates JWT token
6. Backend returns token + user data
7. Frontend stores token in localStorage
8. Frontend includes token in all API requests
```

## Firestore Collections

### `users` Collection

```json
{
  "uid": "abc123xyz",
  "email": "user@example.com",
  "password_hash": "$2a$10$...",
  "display_name": "John Doe",
  "phone_number": "9876543210",
  "role": "customer",
  "email_verified": false,
  "phone_verified": false,
  "created_at": "2024-01-15T10:30:45.123Z",
  "updated_at": "2024-01-15T10:30:45.123Z",
  "last_login": "2024-01-15T10:30:45.123Z"
}
```

## API Endpoints (Unchanged)

All endpoints work the same way:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "displayName": "John",
    "phoneNumber": "9876543210"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get Profile
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Environment Configuration

### Backend (.env.local)

```env
# Firebase (get from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# JWT
JWT_SECRET=change-this-to-random-string-in-production
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env.local)

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_CONTENT_CLIENT_ID=urban-tanker
```

## Testing

### 1. Register User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "TestPassword123",
    "displayName": "Test Customer",
    "phoneNumber": "9876543210",
    "role": "customer"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "TestPassword123"
  }'
```

### 3. Use Token

Save the `idToken` from login response, then:

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

## Advantages Over PostgreSQL

| Feature | PostgreSQL | Firebase Firestore |
|---------|-----------|-------------------|
| Setup | Install locally | Sign up online |
| Maintenance | Manual backups | Automatic |
| Scaling | Need server increase | Auto-scales |
| Cost (small project) | Hosting cost | Free tier covers it |
| Uptime | Your responsibility | 99.95% SLA |
| Offline | No | Yes (mobile) |
| Real-time | Manual polling | Built-in |

## Migration Notes

- ✅ All user data is stored in Firestore
- ✅ No SQL knowledge needed
- ✅ No database URL configuration
- ✅ No port conflicts (Firebase handles ports)
- ✅ Same authentication system
- ✅ Same API endpoints
- ✅ No frontend changes needed

## Troubleshooting

### "Cannot read property 'fieldValue' of undefined"
Make sure `FIREBASE_PRIVATE_KEY` has proper line breaks (use `\n` not actual newlines)

### "Permission denied" errors
Update Firestore security rules (see FIREBASE_SETUP.md)

### "Service account credentials not found"
Check that `.env.local` file exists and has correct values

### TypeScript errors
Run `npm install` in backend directory to install firebase-admin types

## Next Steps

1. ✅ Backend running with Firebase
2. ✅ Frontend connected
3. 📝 Customize Firestore rules in Firebase Console
4. 📊 Add more endpoints using Firestore
5. 🔒 Setup email verification (Firebase Email)
6. 🚀 Deploy to production

## Documentation

- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase setup guide
- **[backend/README.md](./backend/README.md)** - Backend API documentation
- **[README.md](./README.md)** - Main project README

---

For questions or issues, refer to the setup guides above.
