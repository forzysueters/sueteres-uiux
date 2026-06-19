#!/bin/bash

# Start Backend Server
echo "🚀 Starting Backend Server..."
cd server
npm run dev &
BACKEND_PID=$!

cd ..

# Start OCR Model (FastAPI) if it has been set up
OCR_PID=""
if [ -x "ocr/OCR-Model-main/.venv/bin/python" ]; then
  echo "🚀 Starting OCR Model..."
  ( cd ocr/OCR-Model-main && PYTHONUTF8=1 .venv/bin/python -m uvicorn src.api.main:app --port 8000 ) &
  OCR_PID=$!
else
  echo "⚠️  OCR Model não configurado. Veja ocr/INTEGRATION.md (usando mock no front)."
fi

sleep 2

# Start Frontend Server
echo "🚀 Starting Frontend Server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers are running!"
echo ""
echo "📍 Backend:   http://localhost:3000"
echo "📍 OCR Model: http://localhost:8000"
echo "📍 Frontend:  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the servers"
echo ""

# Wait for all to complete
wait $BACKEND_PID $FRONTEND_PID $OCR_PID
