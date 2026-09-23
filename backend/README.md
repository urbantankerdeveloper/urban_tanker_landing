# Urban Tanker Backend API

Complete REST API backend with MongoDB database for Urban Tanker application.

## Prerequisites

- Node.js 18+ installed
- MongoDB Atlas cluster or MongoDB 6+ installed and running
- npm or yarn package manager

## Setup Instructions

### 1. Database Setup

Create a MongoDB Atlas database user and allow the backend host in Atlas Network Access. MongoDB creates the `urban_tanker` database when the initializer creates its collections.

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

Edit `.env.local` with a newly rotated Atlas credential:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DB_NAME=urban_tanker
JWT_SECRET=your-secret-key-change-in-production-12345
JWT_EXPIRE=24h
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 4. Initialize Database

Run the database initialization script to create tables:

```bash
npm run db:init
```

This creates and validates these collections:
- `users`: customer, vendor, and admin accounts distinguished by the `role` field
- `vendors`: vendor availability and dispatch metadata
- `orders`: customer bookings and delivery status
- `content`: tenant-specific application content and coupons
- `sessions`: expiring session records

It also creates tenant-aware unique indexes for users and vendors, dispatch/order indexes, and a TTL index for sessions.

The `content` document is keyed by `client_id` and stores UI configuration in `config` plus coupon records in `coupons`. The default app copy remains the frontend fallback; tenant-specific values can be added to the MongoDB `config` object without changing application code.

## Performance Defaults

- MongoDB connections are reused through one process-wide client pool.
- The default pool allows 20 concurrent database connections per backend instance, with a 5-second wait-queue timeout.
- JSON request bodies are limited to 64 KB and responses are compressed when useful.
- Tenant content is cached in memory for 60 seconds and protected-session lookups use a compound index.
- For higher traffic, run multiple backend instances behind a load balancer and size `MONGODB_MAX_POOL_SIZE` per instance so the combined pool stays within the Atlas connection limit.

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
6. **MongoDB Injection**: Validates request input before database operations
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
- Ensure MongoDB Atlas network access allows the backend host
- Check `MONGODB_URI` and `MONGODB_DB_NAME` in `.env.local`
- Run `npm run db:init` to verify connectivity and indexes

### Port already in use
- Change PORT in `.env.local`
- Or kill process: `lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill`

### Database not initialized
- Run: `npm run db:init`
- Check MongoDB Atlas connection and database-user permissions

### JWT errors
- Ensure JWT_SECRET is set in `.env.local`
- Check token expiration time

## Support

For issues or questions, check the main README.md or create an issue in the repository.
