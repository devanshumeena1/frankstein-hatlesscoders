#!/usr/bin/env bash
# End-to-end smoke test.
# Usage: ./smoke.sh <backend_url> <frontend_url> [expected_version]
set -euo pipefail

BACKEND="${1:-http://localhost:8000}"
FRONTEND="${2:-http://localhost:3000}"
EXPECTED_VERSION="${3:-}"

echo "-> health"
HEALTH=$(curl -sf "$BACKEND/api/health")
echo "$HEALTH"
STATUS=$(echo "$HEALTH" | grep -o '"status":"ok"' || true)
if [ -z "$STATUS" ]; then
  echo "ERROR: health check failed"
  exit 1
fi

if [ -n "$EXPECTED_VERSION" ]; then
  echo "-> version check"
  VERSION=$(echo "$HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)
  if [ "$VERSION" != "$EXPECTED_VERSION" ]; then
    echo "ERROR: expected version $EXPECTED_VERSION, got $VERSION"
    exit 1
  fi
fi

echo "-> frontend"
if ! curl -sf "$FRONTEND/" > /dev/null; then
  echo "ERROR: frontend not reachable"
  exit 1
fi

echo "-> login"
RESULT=$(curl -sf -X POST "$BACKEND/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@phoenix.dev","password":"phoenix123"}')
if ! echo "$RESULT" | grep -q "access_token"; then
  echo "ERROR: login failed"
  echo "$RESULT"
  exit 1
fi

echo "SMOKE OK"
