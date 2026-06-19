@echo off
REM Start Backend Server
echo 🚀 Starting Backend Server...
cd server
start "Backend Server" npm run dev
cd ..

REM Start OCR Model (FastAPI) if it has been set up
if exist "ocr\OCR-Model-main\.venv\Scripts\python.exe" (
  echo 🚀 Starting OCR Model...
  start "OCR Model" cmd /c "cd ocr\OCR-Model-main && set PYTHONUTF8=1 && .venv\Scripts\python.exe -m uvicorn src.api.main:app --port 8000"
) else (
  echo ⚠️  OCR Model nao configurado. Veja ocr\INTEGRATION.md ^(usando mock no front^).
)

REM Wait a moment for backend to start
timeout /t 2 /nobreak

REM Start Frontend Server
echo 🚀 Starting Frontend Server...
start "Frontend Server" npm run dev

echo.
echo ✅ Servers are starting!
echo.
echo 📍 Backend:   http://localhost:3000
echo 📍 OCR Model: http://localhost:8000
echo 📍 Frontend:  http://localhost:5173
echo.
echo Close either command window to stop the respective server.
echo.
