@echo off
cd /d "%~dp0..\.."
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)
if not exist "frontend\dist\index.html" (
    echo Building frontend...
    cd frontend && npm run build && cd ..
)
cd launcher
npx tsx src/index.ts start
pause
