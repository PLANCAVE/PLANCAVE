#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "[frontend] Installing dependencies (npm install)"
  npm install
fi

echo "[frontend] Starting Vite dev server on http://0.0.0.0:5173"
exec npm run dev -- --host 0.0.0.0 --port 5173
