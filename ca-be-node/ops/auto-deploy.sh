#!/bin/bash
# CI/CD: launchd runs this every minute. When origin/main has new ca-be-node or
# test changes, it runs the test suite and deploys. launchd never starts a second
# copy while one is running, so no lock is needed.
#
# This polls rather than using a self-hosted GitHub Actions runner because the
# repo is public: a runner would let pull requests from forks run code here.
set -uo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@17/bin:/usr/bin:/bin:/usr/sbin:/sbin"

BASE="$HOME/srv/ca-app"
REPO_DIR="$BASE/repo"
DEPLOYED="$BASE/shared/deployed-sha"
FAILED="$BASE/shared/failed-sha"
REMOTE="https://github.com/Ocavior/CA-App-Be.git"

log() { echo "$(date '+%F %T') $*"; }

[ -d "$REPO_DIR/.git" ] || git clone --quiet --branch main "$REMOTE" "$REPO_DIR" || exit 1
cd "$REPO_DIR" || exit 1
git fetch --quiet origin main || exit 0   # offline: try again next minute
TARGET="$(git rev-parse FETCH_HEAD)"

CURRENT="$(cat "$DEPLOYED" 2>/dev/null || true)"
[ "$TARGET" = "$CURRENT" ] && exit 0
# A failed commit is not retried every minute; the next commit gets its own attempt.
[ "$TARGET" = "$(cat "$FAILED" 2>/dev/null || true)" ] && exit 0
# main predates the PostgreSQL version: nothing here can be deployed yet.
git cat-file -e "$TARGET:ca-be-node/ops/deploy.sh" 2>/dev/null || exit 0

if [ -n "$CURRENT" ] && ! git diff --name-only "$CURRENT" "$TARGET" | grep -qE '^(ca-be-node|test)/'; then
  log "No ca-be-node or test changes in ${TARGET:0:7}, skipping"
  echo "$TARGET" > "$DEPLOYED"
  exit 0
fi

git reset --quiet --hard "$TARGET"
git clean -qfdx -e node_modules
log "Deploying ${TARGET:0:7}"

if ca-be-node/ops/ci-test.sh && ca-be-node/ops/deploy.sh; then
  echo "$TARGET" > "$DEPLOYED"
  rm -f "$FAILED"
  log "Deployed ${TARGET:0:7}"
else
  echo "$TARGET" > "$FAILED"
  log "FAILED ${TARGET:0:7}: the running version was left in place"
fi
