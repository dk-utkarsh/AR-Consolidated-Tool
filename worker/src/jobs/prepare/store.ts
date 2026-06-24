import { randomUUID } from "node:crypto";
import type { PreparedFile } from "./prepare";

export type PrepareState = "queued" | "running" | "done" | "error";

export interface PrepareJob {
  jobId: string;
  createdAt: string;
  createdBy?: string;
  outDir: string;
  state: PrepareState;
  pct: number;
  msg: string;
  files?: PreparedFile[];
  error?: string;
}

const jobs = new Map<string, PrepareJob>();

export function newJobId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function createJob(j: Pick<PrepareJob, "createdBy" | "outDir">): PrepareJob {
  const job: PrepareJob = {
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

export function getJob(id: string): PrepareJob | undefined {
  return jobs.get(id);
}

export function patchJob(id: string, patch: Partial<PrepareJob>): PrepareJob | undefined {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  jobs.set(id, next);
  return next;
}

export function serializeJob(job: PrepareJob) {
  return {
    job_id: job.jobId,
    created_at: job.createdAt,
    state: job.state,
    pct: job.pct,
    msg: job.msg,
    files: (job.files ?? []).map((f) => ({
      kind: f.kind,
      label: f.label,
      filename: f.filename,
      download_url: `/compliance/prepare/jobs/${job.jobId}/download/${encodeURIComponent(f.filename)}`,
      kept: f.kept,
      dropped: f.dropped,
      mapped_columns: f.mappedColumns,
      blank_columns: f.blankColumns,
      status_column: f.statusColumn,
    })),
    error: job.error ?? null,
  };
}
