#!/bin/bash

# SafeGuard AI — Demo Day Startup Script
# Starts the FastAPI backend and React frontend in separate background processes.
# Press Ctrl+C to stop both.

set -e

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo ""
echo "==========================================================="
echo "  🛡️  SafeGuard AI — Safety Monitoring System"
echo "==========================================================="
echo ""

# ── 1. Check MongoDB is reachable ─────────────────────────────────────────────
echo "Checking MongoDB connection..."
if command -v mongosh >/dev/null 2>&1; then
    mongosh --quiet --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1 \
        && echo "  ✓ MongoDB is running." \
        || echo "  ⚠ MongoDB may not be running. Start it with: brew services start mongodb-community"
elif command -v mongo >/dev/null 2>&1; then
    mongo --quiet --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1 \
        && echo "  ✓ MongoDB is running." \
        || echo "  ⚠ MongoDB may not be running. Start it with: brew services start mongodb-community"
else
    echo "  ℹ mongosh not found — skipping MongoDB check. Make sure mongod is running."
fi

echo ""

# ── 2. Start FastAPI Backend ──────────────────────────────────────────────────
echo "🚀 Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT_DIR/backend"

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo "  ⚠ No venv found in backend/. Trying system Python."
fi

# Check if the port is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  ℹ Port 8000 is already in use — skipping backend start (existing server will be used)."
    BACKEND_PID=""
else
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 &
    BACKEND_PID=$!
    echo "  Backend PID: $BACKEND_PID"
fi

# ── 3. Start React Frontend ───────────────────────────────────────────────────
echo ""
echo "💻 Starting React frontend on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "  node_modules not found — running npm install first..."
    npm install --silent
fi

npm run dev -- --port 3000 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "==========================================================="
echo "  ✅ Both servers starting up. Wait 3–5 seconds then open:"
echo ""
echo "     Browser UI   →  http://localhost:3000"
echo "     API Docs     →  http://localhost:8000/docs"
echo "     Health Check →  http://localhost:8000/health"
echo "==========================================================="
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# ── 4. Wait and clean up on Ctrl+C ───────────────────────────────────────────
cleanup() {
    echo ""
    echo "Shutting down servers..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    echo "Done. Goodbye."
    exit 0
}

trap cleanup INT TERM
wait
