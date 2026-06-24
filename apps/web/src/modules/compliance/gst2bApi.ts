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

export interface RecoSummary {
  matched_count: number; matched_taxable: number; matched_tax: number;
  mismatched_count: number; mismatched_2b_taxable: number; mismatched_books_taxable: number;
  not_in_2b_count: number; not_in_2b_taxable: number; not_in_2b_tax: number;
  not_in_books_count: number; not_in_books_taxable: number; not_in_books_tax: number;
  total_2b_records: number; total_pr_records: number;
}

export interface RecoResponse {
  success: true;
  summary: RecoSummary;
  filename: string;
  download_url: string;
}

export async function reconcile(file2b: File, filePr: File): Promise<RecoResponse> {
  const fd = new FormData();
  fd.append("file_2b", file2b);
  fd.append("file_pr", filePr);
  const res = await fetch(url("/compliance/gst2b/reconcile"), {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return jsonOrThrow<RecoResponse>(res);
}

async function downloadBlob(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(url(path), { headers: authHeaders() });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename=([^;]+)/);
  const filename = m ? m[1].trim() : fallbackName;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function downloadResult(filename: string): Promise<void> {
  await downloadBlob(`/compliance/gst2b/download/${encodeURIComponent(filename)}`, filename);
}

export type Gst2bSampleKind = "gstr2b" | "purchase";

export async function downloadGst2bSample(kind: Gst2bSampleKind): Promise<void> {
  await downloadBlob(`/compliance/gst2b/samples/${kind}`, `${kind}.xlsx`);
}
