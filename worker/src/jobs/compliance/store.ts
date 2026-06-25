import { randomUUID } from "node:crypto";
import { readJsonFile, writeJsonFile } from "../../lib/store";
import type { ComplianceResult } from "./report";

export type ComplianceState = "queued" | "running" | "done" | "error";

export interface ComplianceJob {
  jobId: string;
  createdAt: string;
  createdBy?: string;
  outDir: string;
  state: ComplianceState;
  pct: number;
  msg: string;
  result?: ComplianceResult;
  error?: string;
}

// In-memory map = jobs this process is actively running. Each write is also
// mirrored to disk so a job survives a worker restart — see getJob, which
// surfaces a clear "interrupted" error for jobs the previous process never
// finished (the usual cause being an out-of-memory kill on a huge workbook).
const jobs = new Map<string, ComplianceJob>();

const INTERRUPTED_MSG =
  "Analysis was interrupted — the worker restarted, most likely because the " +
  "uploaded files exceeded available memory. Try smaller files, then analyze again.";

function jobFile(id: string): string {
  return `compliance/jobs/${id}.json`;
}

function persist(job: ComplianceJob): void {
  try { writeJsonFile(jobFile(job.jobId), job); } catch { /* disk best-effort */ }
}

export function newJobId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function createJob(j: Pick<ComplianceJob, "createdBy" | "outDir">): ComplianceJob {
  const job: ComplianceJob = {
    ...j,
    jobId: newJobId(),
    createdAt: new Date().toISOString(),
    state: "queued",
    pct: 0,
    msg: "Queued...",
  };
  jobs.set(job.jobId, job);
  persist(job);
  return job;
}

export function getJob(id: string): ComplianceJob | undefined {
  const live = jobs.get(id);
  if (live) return live;

  // Not in memory: either unknown, or created by a previous (now-restarted)
  // process. Fall back to the persisted copy.
  const disk = readJsonFile<ComplianceJob | null>(jobFile(id), null);
  if (!disk) return undefined;

  // A job left running/queued by a dead process can never complete — its
  // background task died with the process. Surface it as a real error so the
  // browser shows a message instead of polling a "running" job forever.
  if (disk.state === "running" || disk.state === "queued") {
    const failed: ComplianceJob = { ...disk, state: "error", error: INTERRUPTED_MSG };
    persist(failed);
    return failed;
  }
  return disk;
}

export function patchJob(id: string, patch: Partial<ComplianceJob>): ComplianceJob | undefined {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  jobs.set(id, next);
  persist(next);
  return next;
}

export function serializeJob(job: ComplianceJob) {
  return {
    job_id: job.jobId,
    created_at: job.createdAt,
    state: job.state,
    pct: job.pct,
    msg: job.msg,
    result: job.result
      ? {
          success: true,
          filename: job.result.filename,
          download_url: `/compliance/jobs/${job.jobId}/download/${encodeURIComponent(job.result.filename)}`,
          summary: job.result.summary,
        }
      : null,
    error: job.error ?? null,
  };
}
