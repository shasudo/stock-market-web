#!/usr/bin/env bash
# Rocket-side deploy. Run from a checkout of stock-market-web on rocket:
#   bash scripts/deploy.sh
# Installs the Quadlet unit, builds the image, restarts, and refuses to finish
# unless the web app answers healthy. Safe to re-run. The API must already be
# deployed (stock-market-api-network.service provides the shared network and
# the stock-market-api:8080 backend).
set -euo pipefail

# Plain ssh may carry neither XDG_RUNTIME_DIR nor a session bus; user-manager tools
# (systemctl --user, systemd-analyze --user) need both. Lingering must be enabled
# for the deploy user or the manager will not exist.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="$HOME/.config/containers/systemd"
HEALTH_URL="http://127.0.0.1:3000/"

mkdir -p "$UNIT_DIR"

cp "$SRC/deploy/quadlet/stock-market-web.container" "$UNIT_DIR/stock-market-web.container"
echo "==> installed quadlet unit"

systemctl --user daemon-reload

echo "==> building image"
podman build --build-arg API_ORIGIN=http://stock-market-api:8080 -f "$SRC/Containerfile" \
  -t localhost/stock-market-web:latest "$SRC"

# The auth gate reads SESSION_SECRET from this file (mode 600). Touching an
# absent file keeps the service startable; the app then fails closed to login
# until a real secret is placed there.
mkdir -p "$HOME/.config/stock-market-web"
touch "$HOME/.config/stock-market-web/session.env"
chmod 600 "$HOME/.config/stock-market-web/session.env"

echo "==> restarting web"
systemctl --user restart stock-market-web.service

echo "==> waiting for health"
for i in $(seq 1 60); do
  if curl -fsS -m 5 "$HEALTH_URL" >/dev/null; then
    echo "    healthy after ${i}s"
    podman image prune -f >/dev/null
    exit 0
  fi
  sleep 1
done

echo "ERROR: web did not become healthy" >&2
systemctl --user status stock-market-web.service --no-pager -l | head -20
podman logs --tail 40 stock-market-web
exit 1
