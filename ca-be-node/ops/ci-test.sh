#!/bin/bash
# Runs the Jest suite against this checkout, on the test database and the mock
# external-services server. Never touches the real database or port 3000.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SHARED="$HOME/srv/ca-app/shared"
TEST_PORT=3102

cp "$SHARED/.env.test" "$REPO/.env.test"
TEST_DATABASE_URL="$(grep '^TEST_DATABASE_URL=' "$REPO/.env.test" | cut -d= -f2-)"

cd "$REPO"
npm install --no-audit --no-fund --silent
(cd ca-be-node && npm install --no-audit --no-fund --silent)
(cd ca-be-node && DATABASE_URL="$TEST_DATABASE_URL" node scripts/db-migrate.js)

node test/mocks/externalServicesServer.js &
MOCK_PID=$!
(
  cd ca-be-node
  exec env NODE_ENV=test PORT="$TEST_PORT" DATABASE_URL="$TEST_DATABASE_URL" \
    JWT_SECRET=ci-test-secret JWT_EXPIRE=7d SALT_ROUNDS=4 \
    WHATSAPP_API_BASE_URL=http://127.0.0.1:4100/api/whatsapp \
    EMAIL_SERVICE_URL=http://127.0.0.1:4100/email/send \
    EMAIL_SERVICE_BASE_URL=http://127.0.0.1:4100/email \
    node src/index.js
) > /dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" "$MOCK_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://127.0.0.1:$TEST_PORT/api/v1/ca/health" && break
  sleep 1
done

NODE_ENV=test BASE_URL="http://127.0.0.1:$TEST_PORT" npx jest --runInBand
