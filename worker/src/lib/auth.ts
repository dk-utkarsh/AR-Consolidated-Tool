import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config";
import { log } from "./logger";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = config.sharedSecret;
  if (!secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function requireSignedRequest(req: Request, res: Response, next: NextFunction): void {
  if (config.env !== "production" && !config.sharedSecret) {
    log.warn("worker auth: WORKER_SHARED_SECRET unset in non-prod — allowing unsigned request");
    next();
    return;
  }

  const ts = String(req.header("x-worker-timestamp") ?? "");
  const sig = String(req.header("x-worker-signature") ?? "");
  if (!ts || !sig) {
    res.status(401).json({ error: "missing signature headers" });
    return;
  }

  const raw = (req as Request & { rawBody?: string }).rawBody ?? "";
  if (!verifySignature(raw, ts, sig)) {
    res.status(401).json({ error: "invalid signature" });
    return;
  }
  next();
}
