import type { Response, NextFunction } from "express";
import type { SessionedRequest } from "./session";

// Per-user module access control — worker (Render) side.
//
// Mirrors api/_shared/permissions.ts so the USER_MODULES env var behaves
// identically whether a request hits a Vercel route or this worker.
// Keep the two files in sync. See that file for the env var format.

export const ALL_MODULES = ["tds194q", "cheques", "suspense", "compliance"] as const;
export type ModuleId = (typeof ALL_MODULES)[number];

const MODULE_LABELS: Record<ModuleId, string> = {
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
 * Express middleware factory: rejects with 403 unless the session user may
 * access `moduleId`. Must run AFTER requireSession (it reads req.user).
 */
export function requireModule(moduleId: ModuleId) {
  return (req: SessionedRequest, res: Response, next: NextFunction): void => {
    const email = req.user?.email;
    if (!email) {
      res.status(401).json({ error: "missing session" });
      return;
    }
    if (!userCanAccessModule(email, moduleId)) {
      res
        .status(403)
        .json({ error: `You do not have access to the ${MODULE_LABELS[moduleId]} module` });
      return;
    }
    next();
  };
}
