#!/bin/bash
# Releases this checkout's ca-be-node to ~/srv/ca-app and restarts the service,
# going back to the previous release if the new one fails its health check.
# Schema migrations are forward-only: going back does not undo them.
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$HOME/srv/ca-app"
SERVICE="gui/$(id -u)/com.ocavior.ca-app-be"
HEALTH_URL="http://127.0.0.1:3000/api/v1/ca/master-services"   # touches the database
KEEP_RELEASES=5

SHA="${GITHUB_SHA:-$(git -C "$SOURCE" rev-parse HEAD)}"
RELEASE="$BASE/releases/$(date +%Y%m%d%H%M%S)-${SHA:0:7}"

mkdir -p "$RELEASE"
rsync -a --exclude node_modules --exclude '.env*' --exclude logs "$SOURCE/" "$RELEASE/"
ln -sfn "$BASE/shared/.env" "$RELEASE/.env"

cd "$RELEASE"
npm install --omit=dev --no-audit --no-fund --silent
npm run -s db:migrate

PREVIOUS="$(readlink "$BASE/current" || true)"

healthy() {
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$HEALTH_URL" && return 0
    sleep 1
  done
  return 1
}

ln -sfn "$RELEASE" "$BASE/current"
launchctl kickstart -k "$SERVICE"

if ! healthy; then
  echo "Health check failed for $RELEASE" >&2
  if [ -n "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$BASE/current"
    launchctl kickstart -k "$SERVICE"
    healthy && echo "Rolled back to $PREVIOUS" >&2
  fi
  exit 1
fi

ls -1dt "$BASE"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs rm -rf
echo "Deployed $RELEASE"
