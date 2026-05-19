import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// Mirrors api/_shared/auth.ts so tokens minted by /api/login are accepted here.

function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  const seed = process.env.ZOHO_BOOKS_REFRESH_TOKEN?.trim();
  if (!seed || seed.length < 16) {
    throw new Error("Cannot derive session secret: SESSION_SECRET or ZOHO_BOOKS_REFRESH_TOKEN must be set");
  }
  return crypto.createHash("sha256").update(`dashboard-auth:${seed}`).digest("hex");
}

function fromBase64url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

export interface SessionUser {
  email: string;
}

export function verifyToken(token: string): SessionUser | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;

  let payload: string;
  let sig: Buffer;
  try {
    payload = fromBase64url(payloadPart).toString("utf8");
    sig = fromBase64url(sigPart);
  } catch {
    return null;
  }

  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest();
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(sig, expected)) return null;

  const [email, expStr] = payload.split("|");
  const exp = Number(expStr);
  if (!email || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;
  return { email };
}

export interface SessionedRequest extends Request {
  user?: SessionUser;
}

export function requireSession(req: SessionedRequest, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "missing Authorization header" });
    return;
  }
  const token = value.slice(7).trim();
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }
  req.user = session;
  next();
}
