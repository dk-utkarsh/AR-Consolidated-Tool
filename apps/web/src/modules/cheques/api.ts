import { clearSession, getToken } from "@/lib/auth";
import type { DashboardData, CustomerDetail, PullMeta } from "./types";

const WORKER_BASE = (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/$/, "");

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const t = getToken();
  if (t) h["Authorization"] = `Bearer ${t}`;
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
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!res.ok) throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
  return body as T;
}

function url(path: string): string {
  return `${WORKER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function refreshFromZoho(): Promise<PullMeta> {
  const res = await fetch(url("/cheques/refresh"), { method: "POST", headers: authHeaders() });
  return jsonOrThrow<PullMeta>(res);
}

export async function fetchDashboard(asOf?: string): Promise<DashboardData> {
  const qs = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
  const res = await fetch(url(`/cheques/dashboard${qs}`), { headers: authHeaders() });
  return jsonOrThrow<DashboardData>(res);
}

export async function fetchCustomer(name: string, asOf?: string): Promise<CustomerDetail> {
  const qs = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
  const res = await fetch(
    url(`/cheques/customer/${encodeURIComponent(name)}${qs}`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<CustomerDetail>(res);
}
