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
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[deploy] done."
pm2 list
