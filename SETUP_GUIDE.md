# Urban Tanker - Complete Setup Guide

## Overview

The Urban Tanker application now uses:
- **Frontend**: React + Vite (TypeScript)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT-based with bcryptjs password hashing

This guide walks you through setting up both the backend and frontend for development.

## Prerequisites

- **Node.js** 18+ (download from https://nodejs.org/)
- **PostgreSQL** 12+ (download from https://www.postgresql.org/download/)
- **Git** (optional, for version control)
- **npm** or **yarn** (comes with Node.js)

---

## Part 1: Database Setup (PostgreSQL)

### Step 1: Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Windows:**
Download and run the installer from https://www.postgresql.org/download/windows/

### Step 2: Create Database and User

Open PostgreSQL terminal:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE urban_tanker;

# Create user
CREATE USER urban_tanker_user WITH PASSWORD 'SecurePassword123';

# Grant privileges
ALTER ROLE urban_tanker_user SET client_encoding TO 'utf8';
ALTER ROLE urban_tanker_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE urban_tanker_user SET default_transaction_deferrable TO on;
ALTER ROLE urban_tanker_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE urban_tanker TO urban_tanker_user;

# Exit
\q
```

**Verify connection:**
```bash
psql -U urban_tanker_user -d urban_tanker -h localhost
```

---

## Part 2: Backend Setup

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Copy the example file and edit it:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```env
# Database connection - update password if different
DATABASE_URL=postgresql://urban_tanker_user:SecurePassword123@localhost:5432/urban_tanker

# JWT Secret - use a strong random string in production
JWT_SECRET=your-super-secret-key-change-in-production-12345678

# Token expiration
JWT_EXPIRE=7d

# Server configuration
PORT=5000
NODE_ENV=development

# CORS - frontend URL
CORS_ORIGIN=http://localhost:5173
```

### Step 4: Initialize Database

Create tables and schema:

```bash
npm run db:init
```

You should see:
```
Initializing database...
✅ Database initialized successfully
```

### Step 5: Start Backend Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Backend will be running at `http://localhost:5000`

Test it:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-15T10:30:45.123Z"}
```

---

## Part 3: Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
cd ..  # Back to root
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Copy and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Backend API URL - must match backend PORT
VITE_API_BASE_URL=http://localhost:5000

# Content configuration
VITE_CONTENT_CLIENT_ID=urban-tanker
```

### Step 4: Start Frontend Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

---

## Part 4: Running the Complete System

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

Watch for message:
```
🚀 Urban Tanker Backend running on http://0.0.0.0:5000
```

### Terminal 2: Frontend

```bash
npm run dev
```

Watch for message:
```
VITE v... building client environment for production...
  ➜  Local:   http://localhost:5173/
```

### Open the Application

1. Open your browser to `http://localhost:5173`
2. You should see the Urban Tanker login screen

---

## Part 5: User Registration & Login

### Register a New User

1. Click "Register" on the login screen
2. Fill in:
   - **Email**: your-email@example.com
   - **Password**: At least 8 characters
   - **Full Name**: Your Name
   - **Phone**: 10-digit Indian number (e.g., 9876543210)
3. Click "Register"

### Test with Demo Data

You can also test by creating users via cURL:

```bash
# Register a customer
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "TestPassword123",
    "displayName": "Test Customer",
    "phoneNumber": "9876543210",
    "role": "customer"
  }'

# Register a vendor
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@test.com",
    "password": "TestPassword123",
    "displayName": "Test Vendor",
    "phoneNumber": "9876543211",
    "role": "vendor"
  }'

# Register an admin
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123",
    "displayName": "Test Admin",
    "phoneNumber": "9876543212",
    "role": "admin"
  }'
```

### Login Example

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "TestPassword123"
  }'

# Response includes idToken:
# {
#   "message": "Login successful",
#   "user": {...},
#   "idToken": "eyJhbGciOiJIUzI1NiIs..."
# }
```

---

## API Endpoints Reference

### Authentication Endpoints

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe",
  "phoneNumber": "9876543210",
  "role": "customer"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

#### Update Profile
```
PUT /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "Jane Doe",
  "phoneNumber": "9876543211"
}
```

#### Change Password
```
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>
```

---

## Troubleshooting

### Backend won't start

**Error: "connect ECONNREFUSED 127.0.0.1:5432"**
- PostgreSQL is not running
- **Fix**: Start PostgreSQL service
  - macOS: `brew services start postgresql@15`
  - Ubuntu: `sudo service postgresql start`
  - Windows: Restart PostgreSQL service

**Error: "password authentication failed"**
- Database credentials are wrong
- **Fix**: Check DATABASE_URL in `.env.local`

### Frontend shows "Connect to API failed"

**Error: "Failed to fetch" in console**
- Backend is not running
- **Fix**: Make sure backend is running and VITE_API_BASE_URL is correct

**Error: 401 Unauthorized**
- Token is invalid or expired
- **Fix**: Login again

### TypeScript Errors

Run type checking:
```bash
npm run typecheck
```

Common fixes:
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `rm -rf .vite` and `rm -rf dist`

### Database won't initialize

```bash
# Reset database (WARNING: deletes all data)
dropdb -U postgres urban_tanker
createdb -U postgres urban_tanker

# Re-initialize
npm run db:init
```

---

## Development Tips

### Enable Debug Logging

Backend:
```env
DEBUG=*
```

Frontend:
```bash
npm run dev -- --sourcemap
```

### Hot Module Replacement

Frontend changes reload automatically. Backend uses `--watch` flag.

### Database Inspection

View database directly:
```bash
# Connect to database
psql -U urban_tanker_user -d urban_tanker

# List tables
\dt

# Query users
SELECT id, uid, email, display_name, role, created_at FROM users;

# Exit
\q
```

---

## Production Deployment

### Before Deploying

1. **Change JWT_SECRET**: Use a strong random string
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set NODE_ENV=production**

3. **Use HTTPS**: Install SSL certificate

4. **Database Backup**: Configure regular backups

5. **Rate Limiting**: Add rate limiting middleware

6. **Environment**: Use environment variables, not .env files

### Build for Production

Frontend:
```bash
npm run build
npm start
```

Backend:
```bash
NODE_ENV=production npm start
```

---

## Project Structure

```
urban_tanker_landing/
├── backend/                 # Node.js + Express server
│   ├── src/
│   │   ├── server.js       # Express app setup
│   │   ├── database/       # Database connection & init
│   │   ├── routes/         # API routes (auth, etc)
│   │   ├── middleware/     # Auth middleware
│   │   └── utils/          # Utilities (hashing, JWT)
│   ├── package.json
│   └── .env.example
│
├── src/                     # React frontend
│   ├── auth.ts            # Authentication logic
│   ├── App.tsx            # Main app component
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks (useApi)
│   └── types.ts           # TypeScript types
│
├── .env.example           # Frontend env example
├── package.json           # Frontend dependencies
└── vite.config.ts         # Vite configuration
```

---

## Support & Resources

- **Backend API Docs**: See `backend/README.md`
- **Frontend Code**: See `src/` directory
- **Database Schema**: See `backend/src/database/init.js`
- **Issues**: Check troubleshooting section above

---

## Next Steps

1. ✅ Set up PostgreSQL
2. ✅ Run backend server
3. ✅ Run frontend server
4. ✅ Create user account
5. 📝 Explore the app
6. 🔧 Customize for your needs

For questions or issues, refer to the backend and frontend README files.
