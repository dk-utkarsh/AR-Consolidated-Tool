import { clearSession, getToken } from "@/lib/auth";

const WORKER_BASE = (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/$/, "");

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const h: Record<string, string> = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
function url(path: string): string {
  return `${WORKER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("session expired");
  }
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!res.ok) throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
  return body as T;
}

export interface PreparedFileResult {
  kind: string;
  label: string;
  filename: string;
  download_url: string;
  kept: number;
  dropped: number;
  mapped_columns: string[];
  blank_columns: string[];
  status_column: string | null;
}

export type PrepareState = "queued" | "running" | "done" | "error";

export interface PrepareJob {
  job_id: string;
  state: PrepareState;
  pct: number;
  msg: string;
  files: PreparedFileResult[];
  error: string | null;
}

export interface PrepareFiles {
  sales?: File | null;
  einvoice?: File | null;
  creditnote?: File | null;
  cnEinvoice?: File | null;
  ewaybill?: File | null;
}

export async function prepare(files: PrepareFiles): Promise<PrepareJob> {
  const fd = new FormData();
  if (files.sales) fd.append("sales_file", files.sales);
  if (files.einvoice) fd.append("einvoice_file", files.einvoice);
  if (files.creditnote) fd.append("creditnote_file", files.creditnote);
  if (files.cnEinvoice) fd.append("cn_einvoice_file", files.cnEinvoice);
  if (files.ewaybill) fd.append("ewaybill_file", files.ewaybill);
  const res = await fetch(url("/compliance/prepare"), {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return jsonOrThrow<PrepareJob>(res);
}

export async function getPrepareStatus(jobId: string): Promise<PrepareJob> {
  const res = await fetch(url(`/compliance/prepare/jobs/${encodeURIComponent(jobId)}`), {
    headers: authHeaders(),
  });
  return jsonOrThrow<PrepareJob>(res);
}

export async function downloadPrepared(jobId: string, filename: string): Promise<void> {
  const res = await fetch(
    url(`/compliance/prepare/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(filename)}`),
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
