#!/usr/bin/env bash
# Waits until a URL returns HTTP 200 or times out.
# Usage: ./wait-for.sh <url> [timeout_seconds]
set -euo pipefail

URL="${1:?Usage: wait-for.sh <url> [timeout_seconds]}"
TIMEOUT="${2:-60}"
INTERVAL=2
ELAPSED=0

echo "Waiting for $URL ..."
until curl -sf "$URL" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "ERROR: Timed out waiting for $URL after ${TIMEOUT}s"
    exit 1
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "$URL is up after ${ELAPSED}s"
