@echo off
REM Start Backend Server
echo 🚀 Starting Backend Server...
cd server
start "Backend Server" npm run dev
cd ..

REM Wait a moment for backend to start
timeout /t 2 /nobreak

REM Start Frontend Server
echo 🚀 Starting Frontend Server...
start "Frontend Server" npm run dev

echo.
echo ✅ Both servers are starting!
echo.
echo 📍 Backend:  http://localhost:3000
echo 📍 Frontend: http://localhost:5173
echo.
echo Close either command window to stop the respective server.
echo.
