// Zero-dependency single-port gateway for the AR Consolidated Tool.
// Serves apps/web/dist (SPA) and reverse-proxies /api -> dev-api (3001)
// and /worker -> worker (8090, prefix stripped).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../apps/web/dist");
const PORT = Number(process.env.PORT ?? 80);
const API = { host: "127.0.0.1", port: Number(process.env.API_PORT ?? 3001) };
const WORKER = { host: "127.0.0.1", port: Number(process.env.WORKER_PORT ?? 8090) };

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json",
  ".webp": "image/webp", ".txt": "text/plain; charset=utf-8",
};
const mime = (p) => MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";

function proxy(req, res, target, pathOverride) {
  const opts = { host: target.host, port: target.port, method: req.method,
    path: pathOverride ?? req.url, headers: req.headers };
  const pReq = http.request(opts, (pRes) => {
    res.writeHead(pRes.statusCode ?? 502, pRes.headers);
    pRes.pipe(res);
  });
  pReq.on("error", (e) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream unavailable", detail: e.message }));
  });
  req.pipe(pReq);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(distDir, urlPath));
  if (!filePath.startsWith(distDir)) { res.writeHead(403); return res.end("forbidden"); }
  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      res.writeHead(200, { "content-type": mime(filePath), "cache-control": filePath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
      return fs.createReadStream(filePath).pipe(res);
    }
    fs.readFile(path.join(distDir, "index.html"), (e, buf) => {
      if (e) { res.writeHead(404); return res.end("Not found. Did you run the web build?"); }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      res.end(buf);
    });
  });
}

http.createServer((req, res) => {
  const u = req.url || "/";
  if (u === "/api" || u.startsWith("/api/")) return proxy(req, res, API);
  if (u === "/worker" || u.startsWith("/worker/")) return proxy(req, res, WORKER, u.replace(/^\/worker/, "") || "/");
  serveStatic(req, res);
}).listen(PORT, "0.0.0.0", () => console.log(`[gateway] listening on :${PORT} -> static ${distDir}, /api:${API.port}, /worker:${WORKER.port}`));
