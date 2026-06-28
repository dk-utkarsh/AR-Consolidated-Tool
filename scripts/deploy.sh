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

# Compliance Python engine: pm2 (startOrReload above) launches ar-compliance-py,
# which self-installs its Python deps on first start (~1 min) then serves on
# :8091. Poll its health so the deploy log shows whether it actually came up —
# this is the main visibility into it for anyone without shell access.
echo "[deploy] waiting for compliance engine on :8091 (first start installs python deps) ..."
CP_OK=""
for _ in $(seq 1 36); do
  if curl -fsS http://127.0.0.1:8091/health >/tmp/cphealth 2>/dev/null; then
    CP_OK="yes"; echo "[deploy] compliance engine UP: $(cat /tmp/cphealth)"; break
  fi
  sleep 5
done
if [ -z "$CP_OK" ]; then
  echo "[deploy] WARN: compliance engine not responding on :8091 yet."
  echo "[deploy] recent ar-compliance-py logs:"
  pm2 logs ar-compliance-py --lines 40 --nostream || true
fi

echo "[deploy] done."
pm2 list
