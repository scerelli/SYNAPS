#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/scerelli/SYNAPS"
INSTALL_DIR="${SYNAPS_DIR:-/opt/synaps}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${GREEN}▸${NC} $*"; }
warn()    { echo -e "${YELLOW}!${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
success() { echo -e "${GREEN}✓${NC} $*"; }

check_deps() {
  command -v docker >/dev/null 2>&1 || error "Docker is not installed. https://docs.docker.com/engine/install/"
  docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is required. Update Docker Desktop or install the plugin."
  command -v git >/dev/null 2>&1 || error "git is required."
}

generate_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | xxd -p -c 64
  fi
}

echo ""
echo -e "${BOLD}  SYNAPS — Personal Health Monitor${NC}"
echo ""

check_deps

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation at $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git fetch origin
  git reset --hard origin/main
else
  info "Cloning to $INSTALL_DIR..."
  git clone "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

if [ ! -f .env ]; then
  cp .env.example .env

  ENCRYPTION_KEY=$(generate_key)
  sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env

  echo ""
  read -rp "  Port to expose Synaps on [default: 80]: " PORT_INPUT
  PORT="${PORT_INPUT:-80}"
  if grep -q "^PORT=" .env; then
    sed -i "s/^PORT=.*/PORT=$PORT/" .env
  else
    echo "PORT=$PORT" >> .env
  fi

  echo ""
  warn "Disable built-in auth? Only do this if you have a reverse proxy with auth (e.g. Authelia, Cloudflare Access)."
  read -rp "  Disable auth? [y/N]: " DISABLE_AUTH_INPUT
  if [[ "${DISABLE_AUTH_INPUT:-N}" =~ ^[Yy]$ ]]; then
    sed -i "s/^DISABLE_AUTH=.*/DISABLE_AUTH=true/" .env
    warn "Auth disabled. Make sure you secure access at the network/proxy level."
  fi
else
  warn ".env already exists, skipping configuration."
fi

echo ""
info "Building and starting Synaps..."
docker compose up -d --build

echo ""
success "Synaps is running."

HOST_IP=$(hostname -I | awk '{print $1}')
PORT_DISPLAY=$(grep "^PORT=" .env 2>/dev/null | cut -d= -f2 || echo "80")

if [ "$PORT_DISPLAY" = "80" ]; then
  echo -e "  Open ${BOLD}http://${HOST_IP}${NC} in your browser."
else
  echo -e "  Open ${BOLD}http://${HOST_IP}:${PORT_DISPLAY}${NC} in your browser."
fi
echo ""
echo "  Data is stored in Docker volumes (pgdata, uploads)."
echo "  Services restart automatically on reboot (restart: unless-stopped)."
echo ""
echo "  To stop:    docker compose -f $INSTALL_DIR/docker-compose.yml down"
echo "  To update:  curl -fsSL https://raw.githubusercontent.com/scerelli/SYNAPS/main/install.sh | bash"
echo ""
