import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

// ============================================================
// In-memory store. Mirrors Project 1's Python JOBS dict.
// On worker restart this is lost — DB integration is a follow-up.
// ============================================================

interface StoreNamespace<T> {
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  patch(id: string, patch: Partial<T>): T | undefined;
  delete(id: string): boolean;
  list(): T[];
}

function makeStore<T>(): StoreNamespace<T> {
  const map = new Map<string, T>();
  return {
    get: (id) => map.get(id),
    set: (id, v) => void map.set(id, v),
    patch: (id, p) => {
      const cur = map.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...p } as T;
      map.set(id, next);
      return next;
    },
    delete: (id) => map.delete(id),
    list: () => Array.from(map.values()),
  };
}

export const stores = {
  tdsJobs: makeStore<unknown>(),     // Phase 4 will narrow the type
  // add more in later phases as needed
};

// ============================================================
// On-disk JSON helpers. Used for the Cheques module to mirror
// Project 2's CSV file (Phase 5 will use these for the cached
// Zoho transaction pull).
// ============================================================

function ensureDataDir(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function diskPath(...parts: string[]): string {
  ensureDataDir();
  const joined = path.join(config.dataDir, ...parts);
  fs.mkdirSync(path.dirname(joined), { recursive: true });
  return joined;
}

export function readJsonFile<T>(relativePath: string, fallback: T): T {
  const p = diskPath(relativePath);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(relativePath: string, value: unknown): void {
  const p = diskPath(relativePath);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, p);                   // atomic on the same filesystem
}

export function workerDiskPath(relativePath: string): string {
  return diskPath(relativePath);
}
