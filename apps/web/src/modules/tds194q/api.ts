import { clearSession, getToken } from "@/lib/auth";
import type { Job, Preview } from "./types";

// In dev, set VITE_WORKER_URL=http://127.0.0.1:8080 in apps/web/.env.local
// In prod, set it to the Render worker URL (e.g. https://ar-worker.onrender.com).
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
  let body: unknown = undefined;
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

export async function uploadFile(file: File): Promise<Job> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url("/tds194q/upload"), {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return jsonOrThrow<Job>(res);
}

export async function startSend(jobId: string): Promise<void> {
  const res = await fetch(url(`/tds194q/jobs/${encodeURIComponent(jobId)}/send`), {
    method: "POST",
    headers: authHeaders(),
  });
  await jsonOrThrow<{ ok: true }>(res);
}

export async function getStatus(jobId: string): Promise<Job> {
  const res = await fetch(url(`/tds194q/jobs/${encodeURIComponent(jobId)}`), {
    headers: authHeaders(),
  });
  return jsonOrThrow<Job>(res);
}

export function downloadUrl(jobId: string, filename: string): string {
  // Note: download endpoint requires Authorization header, so a plain <a> won't work
  // unless we attach the token via a fetch + blob. See VendorTable for the download
  // helper that handles this.
  return url(`/tds194q/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(filename)}`);
}

export async function downloadFile(jobId: string, filename: string): Promise<void> {
  const res = await fetch(downloadUrl(jobId, filename), { headers: authHeaders() });
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

export async function getPreview(jobId: string, filename: string): Promise<Preview> {
  const res = await fetch(
    url(`/tds194q/jobs/${encodeURIComponent(jobId)}/preview/${encodeURIComponent(filename)}`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<Preview>(res);
}
