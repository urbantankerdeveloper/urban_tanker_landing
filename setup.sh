#!/bin/bash
# Quick setup script for Urban Tanker

echo "🚀 Urban Tanker - Quick Setup"
echo "============================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL 12+"
    exit 1
fi

echo "✅ Node.js and PostgreSQL found"

# Setup Backend
echo ""
echo "📦 Setting up backend..."
cd backend
npm install

echo ""
echo "Creating .env.local..."
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
DATABASE_URL=postgresql://urban_tanker_user:SecurePassword123@localhost:5432/urban_tanker
JWT_SECRET=your-super-secret-key-change-in-production-12345678
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
EOF
    echo "✅ Created .env.local - please update DATABASE credentials"
else
    echo "⚠️  .env.local already exists"
fi

echo ""
echo "🗄️  Initializing database..."
npm run db:init

# Setup Frontend
echo ""
echo "📦 Setting up frontend..."
cd ..
npm install

echo ""
echo "Creating .env.local..."
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
VITE_API_BASE_URL=http://localhost:5000
VITE_CONTENT_CLIENT_ID=urban-tanker
EOF
    echo "✅ Created .env.local"
else
    echo "⚠️  .env.local already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Open terminal 1: cd backend && npm run dev"
echo "2. Open terminal 2: npm run dev"
echo "3. Open browser: http://localhost:5173"
echo ""
echo "For detailed setup, see SETUP_GUIDE.md"
