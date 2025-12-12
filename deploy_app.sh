#!/usr/bin/env bash
# deploy_app.sh - Automated single-VM deployment for PlanCave
#
# Responsibilities:
#   * Install required apt packages (Python, Node, nginx, build tools)
#   * Install Node.js 20 via Nodesource if not already present
#   * Create/refresh Python virtualenv and install backend deps
#   * Build the frontend bundle
#   * Ensure uploads directory ownership
#   * Configure systemd service for Gunicorn
#   * Configure nginx site proxying /api to Gunicorn and serving frontend
#   * Open firewall ports 80/443 if ufw is available
#
# Usage (run as root or via sudo):
#   sudo ./deploy_app.sh
#
# Optional environment overrides:
#   PLANCAVE_SERVICE_NAME, PLANCAVE_SERVER_NAME, PLANCAVE_API_PREFIX,
#   PLANCAVE_BACKEND_PORT, PLANCAVE_BACKEND_HOST, PLANCAVE_APP_USER,
#   PLANCAVE_APP_GROUP, PLANCAVE_ENV_FILE, PLANCAVE_UPLOAD_DIR,
#   PLANCAVE_NODE_MAJOR, PLANCAVE_CONFIGURE_UFW

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[deploy] Please run this script as root (use sudo)." >&2
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/Backend/auth_api"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$PROJECT_ROOT/venv"
DEFAULT_USER="$(stat -c '%U' "$PROJECT_ROOT")"
DEFAULT_GROUP="$(stat -c '%G' "$PROJECT_ROOT")"

SERVICE_NAME="${PLANCAVE_SERVICE_NAME:-plancave}"
SERVER_NAME="${PLANCAVE_SERVER_NAME:-_}"
API_PREFIX="${PLANCAVE_API_PREFIX:-/api}"
BACKEND_PORT="${PLANCAVE_BACKEND_PORT:-8000}"
BACKEND_HOST="${PLANCAVE_BACKEND_HOST:-127.0.0.1}"
APP_USER="${PLANCAVE_APP_USER:-$DEFAULT_USER}"
APP_GROUP="${PLANCAVE_APP_GROUP:-$DEFAULT_GROUP}"
ENV_FILE="${PLANCAVE_ENV_FILE:-$PROJECT_ROOT/.env}"
UPLOAD_DIR="${PLANCAVE_UPLOAD_DIR:-$PROJECT_ROOT/uploads}"
NODE_MAJOR="${PLANCAVE_NODE_MAJOR:-20}"
CONFIGURE_UFW="${PLANCAVE_CONFIGURE_UFW:-true}"

SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_SITE="/etc/nginx/sites-available/${SERVICE_NAME}"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/${SERVICE_NAME}"

log() { echo "[deploy] $*"; }

ensure_packages() {
  log "Installing apt packages"
  apt-get update -y
  apt-get install -y python3.11 python3.11-venv python3-pip \
    nginx build-essential libpq-dev curl git
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_VERSION="$(node -v | sed 's/^v//')"
    NODE_MAJOR_INSTALLED="${NODE_VERSION%%.*}"
  else
    NODE_MAJOR_INSTALLED=0
  fi

  if [[ "$NODE_MAJOR_INSTALLED" != "$NODE_MAJOR" ]]; then
    log "Installing Node.js $NODE_MAJOR.x"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
  else
    log "Node.js $(node -v) already satisfies requirement"
  fi
}

setup_python() {
  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating Python virtualenv in $VENV_DIR"
    python3.11 -m venv "$VENV_DIR"
  fi

  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install -r "$BACKEND_DIR/requirements.txt"
}

build_frontend() {
  log "Building frontend"
  pushd "$FRONTEND_DIR" >/dev/null
  npm install --legacy-peer-deps
  npm run build
  popd >/dev/null
}

ensure_upload_dir() {
  mkdir -p "$UPLOAD_DIR"
  chown -R "$APP_USER":"$APP_GROUP" "$UPLOAD_DIR"
}

write_systemd_unit() {
  log "Writing systemd unit $SYSTEMD_UNIT"
  cat >"$SYSTEMD_UNIT" <<EOF
[Unit]
Description=PlanCave Backend
After=network.target

[Service]
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/gunicorn -b $BACKEND_HOST:$BACKEND_PORT app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx_site() {
  log "Writing nginx site $NGINX_SITE"
  cat >"$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    location $API_PREFIX/ {
        rewrite ^$API_PREFIX/(.*)	/$1 break;
        proxy_pass http://$BACKEND_HOST:$BACKEND_PORT/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    root $FRONTEND_DIR/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
EOF

  ln -sf "$NGINX_SITE" "$NGINX_SITE_ENABLED"
}

configure_firewall() {
  if [[ "$CONFIGURE_UFW" != "true" ]]; then
    log "Skipping firewall configuration"
    return
  fi
  if ! command -v ufw >/dev/null 2>&1; then
    log "ufw not installed; skipping firewall config"
    return
  fi

  log "Allowing HTTP/HTTPS through ufw"
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
}

reload_services() {
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  systemctl reload nginx
}

print_summary() {
  cat <<EOF

[deploy] Done!
Backend service : systemctl status $SERVICE_NAME
Nginx site      : $NGINX_SITE
Frontend URL    : http://<server-ip>/
API base URL    : http://<server-ip>$API_PREFIX/

If you changed DATABASE_URL or secrets, update $ENV_FILE before rerunning.
EOF
}

ensure_packages
ensure_node
setup_python
build_frontend
ensure_upload_dir
write_systemd_unit
write_nginx_site
configure_firewall
reload_services
print_summary
