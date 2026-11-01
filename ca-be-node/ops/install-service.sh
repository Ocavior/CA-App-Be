#!/bin/bash
# Installs (or reinstalls) the API as a per-user launchd service, running the
# current release in ~/srv/ca-app.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/srv/ca-app/current"
LOG_DIR="$HOME/Library/Logs/ca-app-be"
PLIST="$HOME/Library/LaunchAgents/com.ocavior.ca-app-be.plist"

mkdir -p "$LOG_DIR" "$(dirname "$PLIST")"
sed -e "s#__NODE__#$(command -v node)#" \
    -e "s#__APP_DIR__#$APP_DIR#" \
    -e "s#__LOG_DIR__#$LOG_DIR#" \
    "$OPS_DIR/com.ocavior.ca-app-be.plist" > "$PLIST"

launchctl bootout "gui/$(id -u)/com.ocavior.ca-app-be" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed. Logs: $LOG_DIR/server.log"
