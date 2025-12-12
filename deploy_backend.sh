#!/usr/bin/env bash
set -e

# === CONFIG ===
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/Backend/auth_api"
PYTHON_BIN="python3"
VENV_DIR="$PROJECT_ROOT/venv"
REQUIREMENTS_FILE="$PROJECT_ROOT/Backend/auth_api/requirements.txt"

# Default env vars (override in shell or systemd if needed)
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/plancave}"
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-change-this-jwt-secret}"
export ENV="${ENV:-development}"

echo "Using PROJECT_ROOT=$PROJECT_ROOT"
echo "Using DATABASE_URL=$DATABASE_URL"
echo "ENV=$ENV"

# === SETUP VENV ===
if [ ! -d "$VENV_DIR" ]; then
  echo "[backend] Creating virtual environment in $VENV_DIR"
  $PYTHON_BIN -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

# === INSTALL DEPENDENCIES ===
if [ -f "$REQUIREMENTS_FILE" ]; then
  echo "[backend] Installing dependencies from $REQUIREMENTS_FILE"
  pip install --upgrade pip
  pip install -r "$REQUIREMENTS_FILE"
else
  echo "[backend] ERROR: requirements file $REQUIREMENTS_FILE not found."
  exit 1
fi

# === RUN FLASK APP ===
cd "$BACKEND_DIR"

echo "[backend] Starting Flask backend on 0.0.0.0:5000"
exec python app.py
