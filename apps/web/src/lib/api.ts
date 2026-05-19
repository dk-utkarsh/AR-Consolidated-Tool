import { clearSession, getToken } from "./auth";

export interface BankTransaction {
  transaction_id?: string;
  date?: string;
  amount?: number;
  payee?: string;
  reference_number?: string;
  description?: string;
  status?: string;
  transaction_type?: string;
  debit_or_credit?: string;
  [key: string]: unknown;
}

export interface LedgerTransaction {
  transaction_date?: string;
  debit_amount?: number;
  credit_amount?: number;
  debit_or_credit?: "debit" | "credit";
  transaction_type_formatted?: string;
  offset_account_name?: string;
  payee?: string;
  description?: string;
  reference_number?: string;
  entry_number?: string;
  [key: string]: unknown;
}

const API_BASE = "/api";

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("Session expired");
  }
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authedFetch(path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export async function fetchUncategorized(): Promise<BankTransaction[]> {
  const { rows } = await getJson<{ rows: BankTransaction[] }>("/uncategorized");
  return rows;
}

export async function fetchLedger(
  account: "suspense" | "misc-debtor",
  from: string,
  to: string,
): Promise<LedgerTransaction[]> {
  const qs = new URLSearchParams({ from, to });
  const { rows } = await getJson<{ rows: LedgerTransaction[] }>(
    `/ledger/${account}?${qs.toString()}`,
  );
  return rows;
}

export async function refreshCache(): Promise<void> {
  await authedFetch("/refresh", { method: "POST" });
}

export interface MeResponse {
  email: string;
  canMatch: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  return getJson<MeResponse>("/me");
}

export interface CustomerSummary {
  contact_id: string;
  contact_name: string;
  outstanding_receivable_amount?: number;
}

export interface OpenInvoice {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date?: string;
  total: number;
  balance: number;
  status: string;
  reference_number?: string;
}

export interface LocationSummary {
  location_id: string;
  location_name: string;
}

export async function fetchCustomersList(search: string): Promise<CustomerSummary[]> {
  const qs = new URLSearchParams({ q: search });
  const { customers } = await getJson<{ customers: CustomerSummary[] }>(
    `/customers?${qs.toString()}`,
  );
  return customers;
}

export async function fetchCustomerInvoices(customerId: string): Promise<OpenInvoice[]> {
  const { invoices } = await getJson<{ invoices: OpenInvoice[] }>(
    `/customers/${encodeURIComponent(customerId)}/invoices`,
  );
  return invoices;
}

export async function fetchLocationsList(): Promise<LocationSummary[]> {
  const { locations } = await getJson<{ locations: LocationSummary[] }>("/locations");
  return locations;
}

export interface CategorizePayload {
  customer_id: string;
  amount: number;
  date: string;
  reference_number?: string;
  description?: string;
  location_id?: string;
  invoices: Array<{ invoice_id: string; amount_applied: number }>;
  /**
   * "payment" → applies to invoices (sum must equal amount).
   * "advance" → sits as unapplied credit on the customer (invoices must be empty).
   * Defaults to "payment" server-side.
   */
  mode?: "payment" | "advance";
}

export async function categorizeUncategorized(
  bankTxnId: string,
  payload: CategorizePayload,
): Promise<void> {
  const res = await authedFetch(`/uncategorized/${encodeURIComponent(bankTxnId)}/categorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Categorize failed (${res.status})`);
  }
}
