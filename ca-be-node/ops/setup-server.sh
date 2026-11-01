#!/bin/bash
# One-time setup of this Mac as the ca-app server. Safe to re-run. Installs three
# per-user launchd services, all of which start at login and restart on failure:
#   com.ocavior.ca-app-be       the API, from ~/srv/ca-app/current
#   com.ocavior.ca-app-tunnel   Cloudflare Tunnel: ca-app.ocvrs.in -> 127.0.0.1:3000
#   com.ocavior.ca-app-deploy   every minute, tests and deploys new commits on main
#
# Prerequisites: `cloudflared tunnel login` already done, and ca-be-node/.env and
# root .env.test in place.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="$(cd "$OPS_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_SRC/.." && pwd)"
BASE="$HOME/srv/ca-app"
HOSTNAME_PUBLIC="ca-app.ocvrs.in"
TUNNEL_NAME="ca-app"
UID_DOMAIN="gui/$(id -u)"

echo "== Release layout"
mkdir -p "$BASE/shared" "$BASE/releases"
( umask 077
  [ -f "$BASE/shared/.env" ] || cp "$APP_SRC/.env" "$BASE/shared/.env"
  [ -f "$BASE/shared/.env.test" ] || cp "$REPO_ROOT/.env.test" "$BASE/shared/.env.test"
)
if [ ! -e "$BASE/current" ]; then
  RELEASE="$BASE/releases/bootstrap"
  mkdir -p "$RELEASE"
  rsync -a --exclude node_modules --exclude '.env*' --exclude logs "$APP_SRC/" "$RELEASE/"
  ln -sfn "$BASE/shared/.env" "$RELEASE/.env"
  (cd "$RELEASE" && npm install --omit=dev --no-audit --no-fund --silent)
  ln -sfn "$RELEASE" "$BASE/current"
fi

echo "== API service"
lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill 2>/dev/null || true
sleep 1
"$OPS_DIR/install-service.sh"

echo "== Cloudflare Tunnel"
cloudflared tunnel info "$TUNNEL_NAME" >/dev/null 2>&1 || cloudflared tunnel create "$TUNNEL_NAME"
TUNNEL_ID="$(cloudflared tunnel list -o json | python3 -c "import json,sys; print(next(t['id'] for t in json.load(sys.stdin) if t['name']=='$TUNNEL_NAME'))")"
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME_PUBLIC"
cat > "$HOME/.cloudflared/config.yml" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $HOSTNAME_PUBLIC
    service: http://127.0.0.1:3000
  - service: http_status:404
EOF

TUNNEL_PLIST="$HOME/Library/LaunchAgents/com.ocavior.ca-app-tunnel.plist"
cat > "$TUNNEL_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ocavior.ca-app-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v cloudflared)</string>
    <string>tunnel</string>
    <string>run</string>
    <string>$TUNNEL_NAME</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/ca-app-be/tunnel.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/ca-app-be/tunnel.log</string>
</dict>
</plist>
EOF
pkill -f "cloudflared tunnel run $TUNNEL_NAME" 2>/dev/null || true
launchctl bootout "$UID_DOMAIN/com.ocavior.ca-app-tunnel" 2>/dev/null || true
launchctl bootstrap "$UID_DOMAIN" "$TUNNEL_PLIST"

echo "== Auto-deploy"
# A fixed copy, so a commit on main can't change the deployer while it is running.
cp "$OPS_DIR/auto-deploy.sh" "$BASE/shared/auto-deploy.sh"
chmod +x "$BASE/shared/auto-deploy.sh"
DEPLOY_PLIST="$HOME/Library/LaunchAgents/com.ocavior.ca-app-deploy.plist"
cat > "$DEPLOY_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ocavior.ca-app-deploy</string>
  <key>ProgramArguments</key>
  <array><string>$BASE/shared/auto-deploy.sh</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/ca-app-be/deploy.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/ca-app-be/deploy.log</string>
</dict>
</plist>
EOF
launchctl bootout "$UID_DOMAIN/com.ocavior.ca-app-deploy" 2>/dev/null || true
launchctl bootstrap "$UID_DOMAIN" "$DEPLOY_PLIST"

echo "== Verify"
sleep 5
curl -s -m 15 -o /dev/null -w "local  %{http_code}\n" http://127.0.0.1:3000/api/v1/ca/health
curl -s -m 15 -o /dev/null -w "public %{http_code}\n" "https://$HOSTNAME_PUBLIC/api/v1/ca/health"
launchctl list | grep com.ocavior
