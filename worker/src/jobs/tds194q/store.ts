import { randomUUID } from "node:crypto";

export type JobState = "uploaded" | "sending" | "done" | "error";
export type VendorStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface Vendor {
  name: string;
  intendedEmail: string;
  file: string;
  filePath: string;
  hasEmail: boolean;
  status: VendorStatus;
  error: string | null;
}

export interface Job {
  jobId: string;
  createdAt: string;
  createdBy?: string;
  sourceFilename: string;
  outDir: string;
  state: JobState;
  total: number;
  sent: number;
  failed: number;
  vendors: Vendor[];
  error?: string;
  periodLabel: string;
}

const jobs = new Map<string, Job>();

export function newJobId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function createJob(j: Omit<Job, "jobId" | "createdAt" | "state" | "sent" | "failed">): Job {
  const job: Job = {
    ...j,
    jobId: newJobId(),
    createdAt: new Date().toISOString(),
    state: "uploaded",
    sent: 0,
    failed: 0,
  };
  jobs.set(job.jobId, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function patchJob(id: string, patch: Partial<Job>): Job | undefined {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  jobs.set(id, next);
  return next;
}

export function patchVendor(
  id: string,
  vendorName: string,
  patch: Partial<Vendor>,
): Job | undefined {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const vendors = cur.vendors.map((v) => (v.name === vendorName ? { ...v, ...patch } : v));
  const next = { ...cur, vendors };
  jobs.set(id, next);
  return next;
}

/** Public-facing shape (snake_case matches the original Project 1 frontend). */
export function serializeJob(job: Job) {
  return {
    job_id: job.jobId,
    created_at: job.createdAt,
    source_filename: job.sourceFilename,
    state: job.state,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    period_label: job.periodLabel,
    vendors: job.vendors.map((v) => ({
      name: v.name,
      intended_email: v.intendedEmail,
      file: v.file,
      has_email: v.hasEmail,
      status: v.status,
      error: v.error,
    })),
    error: job.error,
  };
}
