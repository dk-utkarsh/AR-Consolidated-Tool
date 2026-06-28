// Launches the Python GST compliance engine (FastAPI) that the worker's
// /compliance/* routes proxy to. Started alongside worker+api+web by
// `npm run start:local`. Local-dev only — production runs this as its own
// service (see ecosystem.config.cjs / render).
//
// Config (env, all optional):
//   COMPLIANCE_PY_DIR           path to the python app dir (has app/main.py)
//   COMPLIANCE_PY_PORT          port to listen on (default 8091; matches COMPLIANCE_PY_URL)
//   PYTHON                      python executable (default "python")
//   COMPLIANCE_PY_SKIP_INSTALL  set to "1" to skip the auto pip-install on start
import { spawn, spawnSync } from "node:child_process";
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

// Auto-install Python deps before starting, so a fresh box (or a new
// requirement) just works without a manual step. pip is idempotent — on an
// already-satisfied env this is a quick no-op. Set COMPLIANCE_PY_SKIP_INSTALL=1
// to skip (e.g. to speed up repeated local restarts).
const reqFile = path.join(PY_DIR, "requirements.txt");
if (process.env.COMPLIANCE_PY_SKIP_INSTALL !== "1" && fs.existsSync(reqFile)) {
  const py = (args) => spawnSync(PYTHON, args, { cwd: PY_DIR, env, stdio: "inherit" });
  console.log(`[compliance-py] installing requirements (set COMPLIANCE_PY_SKIP_INSTALL=1 to skip) ...`);

  // A bare server may not have pip yet — bootstrap it from the stdlib.
  if (py(["-m", "pip", "--version"]).status !== 0) {
    console.log(`[compliance-py] pip not found; bootstrapping via ensurepip ...`);
    py(["-m", "ensurepip", "--upgrade"]);
  }

  const baseArgs = ["-m", "pip", "install", "-r", "requirements.txt", "--disable-pip-version-check"];
  let r = py(baseArgs);
  // Modern Debian/Ubuntu mark the system Python "externally managed" (PEP 668)
  // and reject installs. Retry into the user site with --break-system-packages
  // so no virtualenv or sudo is needed on the box.
  if (!r.error && r.status !== 0) {
    console.log(`[compliance-py] retrying install with --user --break-system-packages (PEP 668) ...`);
    r = py([...baseArgs, "--user", "--break-system-packages"]);
  }

  if (r.error) {
    console.error(`[compliance-py] could not run pip (${r.error.message}); continuing — uvicorn will fail loudly if deps are missing.`);
  } else if (r.status !== 0) {
    console.error(`[compliance-py] pip install failed (exit ${r.status}); continuing — uvicorn will fail loudly if deps are missing.`);
  } else {
    console.log(`[compliance-py] requirements ready.`);
  }
}

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
