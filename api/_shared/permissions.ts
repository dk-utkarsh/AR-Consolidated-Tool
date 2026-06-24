import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./auth";

// Per-user module access control.
//
// Source of truth is the USER_MODULES env var (set on BOTH Vercel and Render):
//
//   USER_MODULES=nikhil@dentalkart.com:suspense; nitish@dentalkart.com:cheques,suspense
//
// Entries are separated by ";" or newlines; within an entry the first ":"
// splits the email from a comma/space-separated list of module ids.
//
// A user NOT listed in USER_MODULES keeps access to all three modules
// (backward compatible). A user listed with an empty module list has no
// access at all.

export const ALL_MODULES = ["tds194q", "cheques", "suspense", "compliance"] as const;
export type ModuleId = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  tds194q: "TDS 194Q",
  cheques: "Cheques",
  suspense: "Uncategorized Suspense",
  compliance: "Compliance Tools",
};

// Forgiving aliases so the env var tolerates the names humans actually type.
const MODULE_ALIASES: Record<string, ModuleId> = {
  tds194q: "tds194q",
  tds: "tds194q",
  "194q": "tds194q",
  "194qtds": "tds194q",
  cheque: "cheques",
  cheques: "cheques",
  suspense: "suspense",
  uncategorized: "suspense",
  uncategorised: "suspense",
  payments: "suspense",
  uncategorizedpayments: "suspense",
  uncategorisedpayments: "suspense",
  compliance: "compliance",
  compliancetools: "compliance",
  complianceguard: "compliance",
  gst: "compliance",
  gst2b: "compliance",
};

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function parseUserModules(): Map<string, Set<ModuleId>> {
  const map = new Map<string, Set<ModuleId>>();
  const raw = process.env.USER_MODULES?.trim();
  if (!raw) return map;

  for (const entry of raw.split(/[;\n]+/)) {
    const line = entry.trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const email = normalizeEmail(line.slice(0, idx));
    if (!email) continue;
    const mods = new Set<ModuleId>();
    for (const part of line.slice(idx + 1).split(/[,\s]+/)) {
      const id = MODULE_ALIASES[part.trim().toLowerCase()];
      if (id) mods.add(id);
    }
    map.set(email, mods);
  }
  return map;
}

/** Modules the given user may access. Unlisted users get all modules. */
export function getModulesForUser(email: string): ModuleId[] {
  const entry = parseUserModules().get(normalizeEmail(email));
  if (!entry) return [...ALL_MODULES];
  return ALL_MODULES.filter((m) => entry.has(m));
}

export function userCanAccessModule(email: string, moduleId: ModuleId): boolean {
  return getModulesForUser(email).includes(moduleId);
}

/**
 * Verify the bearer token AND that the user may access `moduleId`.
 * Sends the appropriate 401/403 response and returns null on failure.
 */
export function requireModule(
  req: VercelRequest,
  res: VercelResponse,
  moduleId: ModuleId,
): { email: string } | null {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!userCanAccessModule(session.email, moduleId)) {
    res
      .status(403)
      .json({ error: `You do not have access to the ${MODULE_LABELS[moduleId]} module` });
    return null;
  }
  return session;
}
