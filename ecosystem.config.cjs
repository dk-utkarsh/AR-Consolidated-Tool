const ROOT = "/home/ubuntu/scripts/AR-Consolidated-Tool";
module.exports = {
  apps: [
    {
      name: "ar-worker",
      cwd: ROOT,
      script: "worker/dist/server.js",
      // Droplet is 4GB / 2 vCPU. Give V8 ~3GB of old-space so large Compliance
      // workbooks don't GC-thrash near the default ceiling (the "fast locally,
      // stalls on the droplet" symptom) and a true overflow surfaces as a clear
      // "heap out of memory" rather than a kernel OOM-kill. Leaves ~1GB for the
      // api + gateway procs, OS, and off-heap xlsx/exceljs buffers.
      // NOTE: node_args only bind when the process is freshly spawned — a pm2
      // *reload* does NOT apply a changed cap. scripts/deploy.sh force-recreates
      // ar-worker on deploy so this actually takes effect.
      node_args: "--max-old-space-size=3072",
      env: { PORT: "8090", WORKER_DATA_DIR: ROOT + "/data" },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: "ar-api",
      cwd: ROOT,
      script: "scripts/dev-api-server.mjs",
      interpreter: "node",
      interpreter_args: "--import tsx",
      env: { DEV_API_PORT: "3001" },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: "ar-gateway",
      cwd: ROOT,
      script: "scripts/gateway.mjs",
      env: { PORT: "80", API_PORT: "3001", WORKER_PORT: "8090" },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      // Python GST compliance engine (FastAPI/uvicorn). The worker proxies the
      // Compliance tab to it at COMPLIANCE_PY_URL (default http://127.0.0.1:8091).
      // The launcher self-installs Python deps on start (PEP 668-safe, no venv
      // or sudo needed), so this comes up purely from a deploy — no manual
      // server steps. First start installs deps (~1 min); restarts are instant.
      name: "ar-compliance-py",
      cwd: ROOT,
      script: "scripts/compliance-py.mjs",
      interpreter: "node",
      env: {
        PYTHON: "python3",
        COMPLIANCE_PY_PORT: "8091",
        COMPLIANCE_PY_DIR: ROOT + "/dentalkart-gst-suite-master-UpdatedCodeNiranjanRaised/dentalkart-gst-suite-master",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
