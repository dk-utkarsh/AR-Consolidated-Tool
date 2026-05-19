import crypto from "node:crypto";

const WORKER_URL = (process.env.WORKER_URL ?? "").replace(/\/$/, "");
const SHARED_SECRET = process.env.WORKER_SHARED_SECRET ?? "";

function assertConfigured(): void {
  if (!WORKER_URL) throw new Error("WORKER_URL is not set");
  if (!SHARED_SECRET) throw new Error("WORKER_SHARED_SECRET is not set");
}

function sign(rawBody: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export interface WorkerResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
  status: number;
}

/**
 * POST a signed JSON request to the worker.
 * The worker rejects requests whose signature doesn't match or whose timestamp is >5 min old.
 */
export async function callWorker<T = unknown>(
  pathname: string,
  body: unknown,
  init: { timeoutMs?: number } = {},
): Promise<WorkerResponse<T>> {
  assertConfigured();
  const raw = JSON.stringify(body ?? {});
  const ts = String(Date.now());
  const sig = sign(raw, ts);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);

  try {
    const res = await fetch(`${WORKER_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-timestamp": ts,
        "x-worker-signature": sig,
      },
      body: raw,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = { raw: text };
    }
    const body = (parsed ?? {}) as Record<string, unknown>;
    return {
      ok: res.ok && body.ok !== false,
      result: body.result as T | undefined,
      error: typeof body.error === "string" ? body.error : undefined,
      status: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire a named job on the worker. */
export async function runWorkerJob<T = unknown>(
  type: string,
  input: Record<string, unknown> = {},
): Promise<WorkerResponse<T>> {
  return callWorker<T>("/jobs/run", { type, input });
}
