# Firebase Setup Guide for Urban Tanker Backend

This backend now uses **Firebase Firestore** for data storage with **JWT authentication**.

## Prerequisites

1. **Firebase Project** - Create one at https://console.firebase.google.com
2. **Node.js 18+** - From https://nodejs.org
3. **Backend Backend API** - This repository

## Step 1: Get Firebase Credentials

### 1.1 Create Service Account

1. Go to Firebase Console → Your Project
2. Click **Settings** (⚙️) → **Project Settings**
3. Go to **Service Accounts** tab
4. Click **Generate New Private Key**
5. Save the JSON file (keep it secure!)

### 1.2 Extract Credentials from JSON

Open the downloaded JSON file and find:
```json
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com",
  ...
}
```

You need:
- **FIREBASE_PROJECT_ID**: `project_id` value
- **FIREBASE_PRIVATE_KEY**: `private_key` value (exactly as shown, including \n)
- **FIREBASE_CLIENT_EMAIL**: `client_email` value

## Step 2: Setup Backend

### 2.1 Install Dependencies

```bash
cd backend
npm install
```

### 2.2 Create Environment File

```bash
cp .env.example .env.local
```

### 2.3 Configure Environment Variables

Edit `backend/.env.local`:

```env
# Firebase Configuration (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# JWT Configuration
JWT_SECRET=your-super-secret-key-minimum-32-characters-recommended
JWT_EXPIRE=7d

# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Important**: Keep `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` secret!

### 2.4 Test Firebase Connection

```bash
npm run db:init
```

You should see:
```
Initializing Firebase Firestore connection...
✅ Firebase Firestore connection successful
✅ Firebase Firestore initialized successfully
```

## Step 3: Start Backend Server

```bash
npm run dev
```

Expected output:
```
🚀 Urban Tanker Backend running on http://0.0.0.0:5000
📝 Health check: http://localhost:5000/health
```

Test it:
```bash
curl http://localhost:5000/health
```

## Step 4: Frontend Setup

### 4.1 Install Dependencies

```bash
# Back to root directory
cd ..
npm install
```

### 4.2 Configure Frontend

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_CONTENT_CLIENT_ID=urban-tanker
```

### 4.3 Start Frontend

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Step 5: Test Authentication

### Register a New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "displayName": "Test User",
    "phoneNumber": "9876543210",
    "role": "customer"
  }'
```

Expected response:
```json
{
  "message": "User registered successfully",
  "user": {
    "uid": "xyz123...",
    "email": "test@example.com",
    "displayName": "Test User",
    "phoneNumber": "9876543210",
    "role": "customer"
  },
  "idToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### Get Current User (requires token)

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Firestore Collections

The backend uses the following Firestore collections:

### `users` Collection

Document structure:
```json
{
  "uid": "unique-user-id",
  "email": "user@example.com",
  "password_hash": "bcrypt-hash",
  "display_name": "User Name",
  "phone_number": "9876543210",
  "role": "customer|vendor|admin",
  "email_verified": false,
  "phone_verified": false,
  "created_at": "2024-01-15T10:30:45.123Z",
  "updated_at": "2024-01-15T10:30:45.123Z",
  "last_login": "2024-01-15T10:30:45.123Z"
}
```

### `sessions` Collection (Optional)

For future session management (token blacklisting, multiple sessions, etc.)

## API Endpoints

### POST `/api/auth/register`
Register new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "Full Name",
  "phoneNumber": "9876543210",
  "role": "customer"
}
```

### POST `/api/auth/login`
Login user
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### GET `/api/auth/me`
Get current user (requires Bearer token)

### PUT `/api/auth/me`
Update profile (requires Bearer token)
```json
{
  "displayName": "New Name",
  "phoneNumber": "9876543211"
}
```

### POST `/api/auth/change-password`
Change password (requires Bearer token)
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### POST `/api/auth/logout`
Logout (requires Bearer token)

## Troubleshooting

### Error: "FIREBASE_PROJECT_ID is not set"
Your environment variables are not loaded. Check:
1. `.env.local` file exists in backend folder
2. Correct values are set
3. No extra spaces around `=` sign

### Error: "Firebase initialization failed"
Firebase credentials are invalid. Check:
1. FIREBASE_PROJECT_ID matches your Firebase project
2. FIREBASE_PRIVATE_KEY has correct format with `\n` properly escaped
3. FIREBASE_CLIENT_EMAIL is exact match from service account JSON

### Error: "CORS error"
Frontend and backend URLs don't match. Check:
1. CORS_ORIGIN in backend `.env.local` is `http://localhost:5173`
2. Frontend VITE_API_BASE_URL is `http://localhost:5000`

### Firestore Rules Error
If you get permission errors when reading/writing to Firestore:

In Firebase Console:
1. Go to Firestore Database
2. Click **Rules** tab
3. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow service account full access (backend)
    match /{document=**} {
      allow read, write: if request.auth != null || request.auth.uid != null;
    }
  }
}
```

## Production Deployment

### Backend Deployment (Heroku, Railway, AWS, etc.)

1. Generate strong JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Set environment variables in your hosting platform
3. Deploy code
4. Test health endpoint

### Frontend Deployment (Vercel, Netlify, etc.)

1. Set `VITE_API_BASE_URL` to your backend URL (e.g., `https://your-api.herokuapp.com`)
2. Deploy frontend
3. Test login/registration

## Security Tips

1. **Private Key**: Never commit `.env.local` to Git. Add it to `.gitignore`
2. **JWT Secret**: Use a strong random string (min 32 chars)
3. **CORS**: Limit `CORS_ORIGIN` to your frontend URL in production
4. **Firestore Rules**: Set strict security rules in production
5. **HTTPS**: Always use HTTPS in production
6. **Rate Limiting**: Add rate limiting to auth endpoints

## Next Steps

- ✅ Backend running with Firebase
- ✅ Frontend connected to backend
- 📝 Customize authentication (social login, MFA, etc.)
- 📊 Add application-specific API endpoints
- 🚀 Deploy to production

---

For more info on Firebase Admin SDK, see: https://firebase.google.com/docs/admin/setup
