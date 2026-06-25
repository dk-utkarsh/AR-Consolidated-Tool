#!/usr/bin/env bash
# Auto-deploy: run by GitHub Actions over SSH on every push to main.
# Pulls latest main, installs deps, rebuilds worker + web, reloads pm2.
set -euo pipefail

APP_DIR="/home/ubuntu/scripts/AR-Consolidated-Tool"
BRANCH="main"
cd "$APP_DIR"

echo "[deploy] $(date -u +%FT%TZ) starting on $(hostname)"
echo "[deploy] fetching origin/$BRANCH ..."
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "[deploy] now at $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

echo "[deploy] installing dependencies ..."
npm install --no-audit --no-fund

echo "[deploy] building worker ..."
npm run build:worker
echo "[deploy] building web ..."
npm run build:web

echo "[deploy] reloading pm2 services ..."
# api + gateway: graceful zero-downtime reload.
pm2 startOrReload ecosystem.config.cjs --update-env

# ar-worker: its node_args (--max-old-space-size heap cap) only bind at a FRESH
# spawn — a pm2 reload re-runs the script but keeps the original interpreter
# args, so a changed cap would silently no-op. Force-recreate just the worker so
# the cap actually applies. (api/gateway stay up from the reload above.)
echo "[deploy] recreating ar-worker so node_args (heap cap) take effect ..."
pm2 delete ar-worker >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --only ar-worker --update-env
pm2 save

# Surface the live worker's heap cap in the deploy log so we can confirm it stuck.
echo "[deploy] ar-worker node args:"
pm2 describe ar-worker | grep -iE 'node args|script args|exec mode' || true
WPID="$(pgrep -f 'worker/dist/server.js' | head -n1 || true)"
if [ -n "${WPID:-}" ]; then
  echo "[deploy] worker pid $WPID cmdline:"
  tr '\0' ' ' < "/proc/$WPID/cmdline"; echo
fi

echo "[deploy] done."
pm2 list
