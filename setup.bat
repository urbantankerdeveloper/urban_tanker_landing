@echo off
echo.
echo Urban Tanker - Quick Setup (Windows)
echo ====================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

echo [OK] Node.js found
echo.

REM Setup Backend
echo Setting up backend...
cd backend
call npm install

echo.
echo Creating .env.local...
if not exist .env.local (
    (
        echo DATABASE_URL=postgresql://urban_tanker_user:SecurePassword123@localhost:5432/urban_tanker
        echo JWT_SECRET=your-super-secret-key-change-in-production-12345678
        echo JWT_EXPIRE=7d
        echo PORT=5000
        echo NODE_ENV=development
        echo CORS_ORIGIN=http://localhost:5173
    ) > .env.local
    echo [OK] Created .env.local - update DATABASE credentials if needed
) else (
    echo [SKIP] .env.local already exists
)

echo.
echo Initializing database...
call npm run db:init

REM Setup Frontend
echo.
echo Setting up frontend...
cd ..
call npm install

echo.
echo Creating .env.local...
if not exist .env.local (
    (
        echo VITE_API_BASE_URL=http://localhost:5000
        echo VITE_CONTENT_CLIENT_ID=urban-tanker
    ) > .env.local
    echo [OK] Created .env.local
) else (
    echo [SKIP] .env.local already exists
)

echo.
echo ============================================
echo Setup complete!
echo.
echo Next steps:
echo 1. Open PowerShell/CMD 1: cd backend ^&^& npm run dev
echo 2. Open PowerShell/CMD 2: npm run dev
echo 3. Open browser: http://localhost:5173
echo.
echo For detailed setup, see SETUP_GUIDE.md
echo ============================================
pause
