import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TOKEN_TTL_DAYS = 7;
const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;

  const seed = process.env.ZOHO_BOOKS_REFRESH_TOKEN?.trim();
  if (!seed || seed.length < 16) {
    throw new Error(
      "Cannot derive session secret: ZOHO_BOOKS_REFRESH_TOKEN must be set",
    );
  }
  return crypto.createHash("sha256").update(`dashboard-auth:${seed}`).digest("hex");
}

interface AuthUser {
  email: string;
  password: string;
}

function parseUsers(): AuthUser[] {
  const users: AuthUser[] = [];

  const sharedPassword = process.env.DASHBOARD_PASSWORD?.trim();
  const emailsRaw = process.env.DASHBOARD_USERS?.trim();
  if (sharedPassword && emailsRaw) {
    for (const part of emailsRaw.split(/[,;\s]+/)) {
      const email = part.trim().toLowerCase();
      if (email) users.push({ email, password: sharedPassword });
    }
  }

  for (const [key, raw] of Object.entries(process.env)) {
    if (!/^USER_\d+$/i.test(key)) continue;
    if (typeof raw !== "string") continue;
    const value = raw.trim().replace(/^['"]|['"]$/g, "").trim();
    const idx = value.indexOf(":");
    if (idx <= 0 || idx === value.length - 1) continue;
    const email = value.slice(0, idx).trim().toLowerCase();
    const password = value.slice(idx + 1);
    if (email && password) users.push({ email, password });
  }
  return users;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function validateCredentials(
  email: string,
  password: string,
): AuthUser | null {
  const normalized = email.trim().toLowerCase();
  const users = parseUsers();
  for (const u of users) {
    if (timingSafeEqual(u.email, normalized) && timingSafeEqual(u.password, password)) {
      return u;
    }
  }
  return null;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

export function signToken(email: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${email}|${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest();
  return `${base64url(payload)}.${base64url(sig)}`;
}

export function verifyToken(token: string): { email: string } | null {
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

  const expectedSig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest();

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  const [email, expiresAtStr] = payload.split("|");
  const expiresAt = Number(expiresAtStr);
  if (!email || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  return { email };
}

export function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): { email: string } | null {
  const header = req.headers["authorization"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return null;
  }
  const token = value.slice(7).trim();
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return session;
}

export function getMatchUserAllowlist(): string[] {
  const raw = process.env.DASHBOARD_MATCH_USERS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isMatchUser(email: string): boolean {
  const allow = getMatchUserAllowlist();
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

export function requireMatchUser(
  req: VercelRequest,
  res: VercelResponse,
): { email: string } | null {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!isMatchUser(session.email)) {
    res.status(403).json({ error: "Not authorized to categorize payments" });
    return null;
  }
  return session;
}
