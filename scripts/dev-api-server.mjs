// Local-only dev shim that emulates `vercel dev` for the api/ directory.
// Walks api/**/*.ts, mounts each as an Express route. Converts Vercel-style
// dynamic segments ([param]) into Express segments (:param). Merges
// req.params into req.query so handlers see what they'd see on Vercel.
//
// In production we deploy api/*.ts to Vercel as real serverless functions;
// this file is only for `npm run start:local`. Run via `tsx` so .ts files
// can be imported dynamically.

import "dotenv/config";
import express from "express";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { readdirSync, statSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const apiRoot = path.resolve(projectRoot, "api");
const PORT = Number(process.env.DEV_API_PORT ?? 3001);

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use((req, _res, next) => {
  console.log(`[api-dev] ${req.method} ${req.path}`);
  next();
});

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("_")) continue;          // skip api/_shared/
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function toRoutePath(absFile) {
  // /api/customers/[customerId]/invoices.ts -> /api/customers/:customerId/invoices
  const rel = path.relative(apiRoot, absFile).replace(/\\/g, "/");
  const noExt = rel.replace(/\.ts$/, "");
  const dynamic = noExt.replace(/\[(\w+)\]/g, ":$1");
  return `/api/${dynamic}`;
}

const files = walk(apiRoot);
console.log(`[api-dev] found ${files.length} api file(s):`);

for (const file of files) {
  const routePath = toRoutePath(file);
  const fileUrl = pathToFileURL(file).href;
  try {
    const mod = await import(fileUrl);
    const handler = mod.default;
    if (typeof handler !== "function") {
      console.warn(`  - ${routePath} (skipped: no default export)`);
      continue;
    }
    app.all(routePath, async (req, res) => {
      // Vercel exposes path params on req.query, not req.params.
      req.query = { ...req.query, ...req.params };
      try {
        await handler(req, res);
      } catch (e) {
        console.error(`[api-dev] handler error at ${routePath}:`, e);
        if (!res.headersSent) res.status(500).json({ error: e?.message ?? "handler crashed" });
      }
    });
    console.log(`  + ${routePath}`);
  } catch (e) {
    console.warn(`  ! ${routePath} (failed to load: ${e?.message ?? e})`);
  }
}

app.use((req, res) => {
  res.status(404).json({ error: `not found: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`[api-dev] listening on http://127.0.0.1:${PORT}`);
});
