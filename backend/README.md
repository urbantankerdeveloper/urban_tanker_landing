# Urban Tanker Backend API

Complete REST API backend with PostgreSQL database for Urban Tanker application.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- npm or yarn package manager

## Setup Instructions

### 1. Database Setup

Install PostgreSQL if not already installed:

```bash
# macOS (using Homebrew)
brew install postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows: Download from https://www.postgresql.org/download/windows/
```

Start PostgreSQL service and create a database:

```bash
# Create database and user
createdb urban_tanker
createuser urban_tanker_user
```

### 2. Backend Installation

```bash
cd backend
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
DATABASE_URL=postgresql://urban_tanker_user:password@localhost:5432/urban_tanker
JWT_SECRET=your-secret-key-change-in-production-12345
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Update PostgreSQL connection string with your actual credentials.

### 4. Initialize Database

Run the database initialization script to create tables:

```bash
npm run db:init
```

This will create:
- `users` table with all required fields
- `sessions` table for token management
- Indexes for optimal performance

### 5. Start Backend Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### Authentication Routes

#### Register New User
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe",
  "phoneNumber": "9876543210",
  "role": "customer"  // or "vendor", "admin"
}

Response (201):
{
  "message": "User registered successfully",
  "user": {
    "uid": "generated-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "phoneNumber": "9876543210",
    "role": "customer"
  },
  "idToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "message": "Login successful",
  "user": {
    "uid": "generated-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "phoneNumber": "9876543210",
    "role": "customer"
  },
  "idToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Get Current User Profile
```
GET /api/auth/me
Authorization: Bearer <idToken>

Response (200):
{
  "user": {
    "uid": "generated-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "phoneNumber": "9876543210",
    "role": "customer",
    "emailVerified": false,
    "phoneVerified": false
  }
}
```

#### Update User Profile
```
PUT /api/auth/me
Authorization: Bearer <idToken>
Content-Type: application/json

{
  "displayName": "Jane Doe",
  "phoneNumber": "9876543211"
}

Response (200):
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

#### Change Password
```
POST /api/auth/change-password
Authorization: Bearer <idToken>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}

Response (200):
{
  "message": "Password changed successfully"
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <idToken>

Response (200):
{
  "message": "Logged out successfully"
}
```

## Database Schema

### Users Table
```sql
- id: INTEGER (Primary Key)
- uid: VARCHAR(255) (Unique identifier for frontend)
- email: VARCHAR(255) (Unique)
- password_hash: VARCHAR(255) (Bcrypt hashed)
- display_name: VARCHAR(255)
- phone_number: VARCHAR(20)
- role: VARCHAR(50) ('customer', 'vendor', 'admin')
- email_verified: BOOLEAN
- phone_verified: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- last_login: TIMESTAMP
```

### Sessions Table
```sql
- id: INTEGER (Primary Key)
- user_id: INTEGER (Foreign Key -> users.id)
- token: VARCHAR(500) (Unique JWT token)
- expires_at: TIMESTAMP
- created_at: TIMESTAMP
- ip_address: VARCHAR(45)
- user_agent: VARCHAR(500)
```

## Testing with cURL

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "displayName": "Test User",
    "phoneNumber": "9876543210"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'

# Get current user (replace TOKEN with actual token from login)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Security Considerations

1. **Passwords**: Always hashed with bcryptjs before storage
2. **JWT Tokens**: Set appropriate expiration times in `.env`
3. **CORS**: Configure allowed origins based on your domain
4. **HTTPS**: Use HTTPS in production
5. **Environment Variables**: Never commit `.env` file to version control
6. **SQL Injection**: Uses parameterized queries
7. **CSRF Protection**: Implement in production if needed
8. **Rate Limiting**: Add rate limiting middleware for production

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (minimum 32 characters)
3. Enable HTTPS/TLS
4. Configure database with backups
5. Set up proper error logging
6. Use environment variables for all secrets
7. Implement rate limiting and request throttling
8. Add request validation and sanitization
9. Set up monitoring and alerting
10. Use a reverse proxy (nginx/Apache)

## Troubleshooting

### Connection refused
- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env.local`
- Verify database exists: `psql -l`

### Port already in use
- Change PORT in `.env.local`
- Or kill process: `lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill`

### Database not initialized
- Run: `npm run db:init`
- Check PostgreSQL logs for errors

### JWT errors
- Ensure JWT_SECRET is set in `.env.local`
- Check token expiration time

## Support

For issues or questions, check the main README.md or create an issue in the repository.
