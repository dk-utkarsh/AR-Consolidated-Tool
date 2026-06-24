import { randomUUID } from "node:crypto";
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

const jobs = new Map<string, ComplianceJob>();

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
  return job;
}

export function getJob(id: string): ComplianceJob | undefined {
  return jobs.get(id);
}

export function patchJob(id: string, patch: Partial<ComplianceJob>): ComplianceJob | undefined {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  jobs.set(id, next);
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
