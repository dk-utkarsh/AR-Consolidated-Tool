import { clearSession, getToken } from "@/lib/auth";
import type { AnalyzeFiles, ComplianceJob } from "./types";

// Same worker the TDS + Cheques modules talk to (VITE_WORKER_URL).
const WORKER_BASE = (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/$/, "");

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const h: Record<string, string> = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("session expired");
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

function url(path: string): string {
  return `${WORKER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function analyze(files: AnalyzeFiles): Promise<ComplianceJob> {
  const fd = new FormData();
  fd.append("sales_file", files.sales);
  fd.append("einvoice_file", files.einvoice);
  if (files.ewaybill) fd.append("ewaybill_file", files.ewaybill);
  if (files.creditnote) fd.append("creditnote_file", files.creditnote);
  if (files.cnEinvoice) fd.append("cn_einvoice_file", files.cnEinvoice);
  const res = await fetch(url("/compliance/analyze"), {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return jsonOrThrow<ComplianceJob>(res);
}

export async function getStatus(jobId: string): Promise<ComplianceJob> {
  const res = await fetch(url(`/compliance/jobs/${encodeURIComponent(jobId)}`), {
    headers: authHeaders(),
  });
  return jsonOrThrow<ComplianceJob>(res);
}

export async function downloadReport(jobId: string, filename: string): Promise<void> {
  const res = await fetch(
    url(`/compliance/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(filename)}`),
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

export type SampleKind = "sales" | "einvoice" | "ewaybill" | "creditnote" | "cn-einvoice";

export async function downloadSample(kind: SampleKind): Promise<void> {
  const res = await fetch(url(`/compliance/samples/${kind}`), { headers: authHeaders() });
  if (!res.ok) throw new Error(`sample download failed (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename=([^;]+)/);
  const filename = m ? m[1].trim() : `${kind}.xlsx`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
