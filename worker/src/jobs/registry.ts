import { log } from "../lib/logger";

export type JobInput = Record<string, unknown>;
export type JobResult = { ok: true; result?: unknown } | { ok: false; error: string };
export type JobHandler = (input: JobInput) => Promise<JobResult>;

function notImplemented(name: string): JobHandler {
  return async () => ({ ok: false, error: `job '${name}' not yet implemented` });
}

// Wire actual handlers in later phases (4: TDS, 5: Cheques).
export const jobs: Record<string, JobHandler> = {
  "tds194q.bifurcate":       notImplemented("tds194q.bifurcate"),
  "tds194q.send-emails":     notImplemented("tds194q.send-emails"),
  "cheques.ocr":             notImplemented("cheques.ocr"),
  "cheques.pull-zoho-txns":  notImplemented("cheques.pull-zoho-txns"),
};

export async function runJob(type: string, input: JobInput): Promise<JobResult> {
  const handler = jobs[type];
  if (!handler) return { ok: false, error: `unknown job type: ${type}` };
  log.info("job.start", { type });
  try {
    const out = await handler(input);
    log.info("job.end", { type, ok: out.ok });
    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("job.fail", { type, error: message });
    return { ok: false, error: message };
  }
}
