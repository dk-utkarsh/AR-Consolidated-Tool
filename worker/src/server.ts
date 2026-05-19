import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config, assertProductionSecrets } from "./lib/config";
import { requireSignedRequest } from "./lib/auth";
import { log } from "./lib/logger";
import { runJob, type JobInput } from "./jobs/registry";
import tds194qRouter from "./routes/tds194q";
import chequesRouter from "./routes/cheques";

assertProductionSecrets();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-worker-timestamp", "x-worker-signature"],
  }),
);

// Capture raw body so the HMAC middleware can re-verify the exact bytes.
// Multer handles multipart on its own, so JSON parsing only applies to non-multipart.
app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

// Public health check (no signature).
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString(), env: config.env });
});

// Module routers (require session tokens, not HMAC — talked to directly by browser).
app.use("/tds194q", tds194qRouter);
app.use("/cheques", chequesRouter);

// HMAC-signed admin / cron endpoint — used by Vercel routes & scheduled triggers.
app.post("/jobs/run", requireSignedRequest, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { type?: string; input?: JobInput };
  const type = String(body.type ?? "");
  const input = (body.input ?? {}) as JobInput;
  if (!type) {
    res.status(400).json({ error: "missing 'type'" });
    return;
  }
  const out = await runJob(type, input);
  res.status(out.ok ? 200 : 502).json(out);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `not found: ${req.method} ${req.path}` });
});

app.listen(config.port, () => {
  log.info("worker.listening", { port: config.port, env: config.env });
});
