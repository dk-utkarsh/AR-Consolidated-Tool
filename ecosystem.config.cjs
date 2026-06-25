const ROOT = "/home/ubuntu/scripts/AR-Consolidated-Tool";
module.exports = {
  apps: [
    {
      name: "ar-worker",
      cwd: ROOT,
      script: "worker/dist/server.js",
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
  ],
};
