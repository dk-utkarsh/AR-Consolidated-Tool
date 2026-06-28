// Launches the Python GST compliance engine (FastAPI) that the worker's
// /compliance/* routes proxy to. Started alongside worker+api+web by
// `npm run start:local`. Local-dev only — production runs this as its own
// service (see ecosystem.config.cjs / render).
//
// Config (env, all optional):
//   COMPLIANCE_PY_DIR   path to the python app dir (has app/main.py)
//   COMPLIANCE_PY_PORT  port to listen on (default 8091; matches COMPLIANCE_PY_URL)
//   PYTHON              python executable (default "python")
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PY_DIR = process.env.COMPLIANCE_PY_DIR
  ? path.resolve(process.env.COMPLIANCE_PY_DIR)
  : path.join(ROOT, "dentalkart-gst-suite-master-UpdatedCodeNiranjanRaised", "dentalkart-gst-suite-master");
const PORT = process.env.COMPLIANCE_PY_PORT || "8091";
const PYTHON = process.env.PYTHON || "python";

if (!fs.existsSync(path.join(PY_DIR, "app", "main.py"))) {
  console.error(`[compliance-py] cannot find app/main.py under ${PY_DIR}`);
  console.error(`[compliance-py] set COMPLIANCE_PY_DIR to the python GST suite folder.`);
  process.exit(1);
}

// Output dirs the Python engine writes reports to (defaults are /tmp/* which
// don't exist on Windows). The worker re-downloads each report to its own disk,
// so these are just a scratch area.
const OUT = path.join(PY_DIR, "_run_outputs");
const env = {
  ...process.env,
  COMPLIANCE_OUTPUT_DIR: path.join(OUT, "compliance"),
  GST_OUTPUT_DIR: path.join(OUT, "gst2b"),
};
fs.mkdirSync(env.COMPLIANCE_OUTPUT_DIR, { recursive: true });
fs.mkdirSync(env.GST_OUTPUT_DIR, { recursive: true });

console.log(`[compliance-py] starting uvicorn on 127.0.0.1:${PORT} (cwd: ${PY_DIR})`);

const child = spawn(
  PYTHON,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", PORT],
  { cwd: PY_DIR, env, stdio: "inherit" },
);

child.on("error", (e) => {
  console.error(`[compliance-py] failed to start (${e.message}). Is Python installed and on PATH?`);
  console.error(`[compliance-py] one-time setup: pip install -r requirements.txt  (in ${PY_DIR})`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { try { child.kill(); } catch { /* already gone */ } });
}
