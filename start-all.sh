#!/bin/bash

# Start Backend Server
echo "🚀 Starting Backend Server..."
cd server
npm run dev &
BACKEND_PID=$!

sleep 2

# Start Frontend Server
echo "🚀 Starting Frontend Server..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📍 Backend:  http://localhost:3000"
echo "📍 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both to complete
wait $BACKEND_PID $FRONTEND_PID
