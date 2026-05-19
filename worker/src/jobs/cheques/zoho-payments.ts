// Zoho Books customer-payment lookup. Mirrors cheque_lookup.py:
//   search_payments_by_cheque + get_payment_full + determine_status +
//   _name_matches + date/amount filtering.

import { config } from "../../lib/config";
import { getAccessToken } from "../tds194q/zoho";   // reuse the token cache

const DATE_WINDOW_DAYS_BEFORE = 30;
const DATE_WINDOW_DAYS_AFTER = 60;
const AMOUNT_TOLERANCE_RUPEES = 1;

interface ZohoPaymentListItem {
  payment_id?: string;
  reference_number?: string;
  date?: string;
  amount?: number;
  customer_name?: string;
  payment_number?: string;
}

interface ZohoPaymentInvoice {
  invoice_number?: string;
}

interface ZohoPaymentRefund {
  description?: string;
  reason?: string;
}

interface ZohoPaymentFull extends ZohoPaymentListItem {
  unused_amount?: number;
  invoices?: ZohoPaymentInvoice[];
  payment_refunds?: ZohoPaymentRefund[];
}

function apiBase(): string {
  return config.zoho.apiDomain;
}

function orgId(): string {
  if (!config.zoho.organizationId) {
    throw new Error("ZOHO_BOOKS_ORGANIZATION_ID is not set");
  }
  return config.zoho.organizationId;
}

async function zohoGet<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ organization_id: orgId(), ...params }).toString();
  const url = `${apiBase()}/books/v3/${path}?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Zoho ${path} HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

export async function searchPaymentsByCheque(token: string, chequeNo: string): Promise<ZohoPaymentListItem[]> {
  const json = await zohoGet<{ customerpayments?: ZohoPaymentListItem[] }>(
    token,
    "customerpayments",
    { reference_number_contains: chequeNo, per_page: "200" },
  );
  const seen = new Map<string, ZohoPaymentListItem>();
  for (const p of json.customerpayments ?? []) {
    if (p.payment_id && !seen.has(p.payment_id)) seen.set(p.payment_id, p);
  }
  return Array.from(seen.values());
}

async function getPaymentFull(token: string, paymentId: string): Promise<ZohoPaymentFull> {
  const json = await zohoGet<{ payment?: ZohoPaymentFull }>(token, `customerpayments/${paymentId}`, {});
  return json.payment ?? {};
}

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normName(s: string | null | undefined): string {
  if (!s) return "";
  let n = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const suf of ["privatelimited", "pvtltd", "pvtltdo", "limited", "ltd", "llp", "incorporated", "inc", "company", "co"]) {
    if (n.endsWith(suf)) { n = n.slice(0, -suf.length); break; }
  }
  return n;
}

function nameMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export interface PaymentStatus {
  status: string;
  invoice: string;
}

export function determineStatus(p: ZohoPaymentFull): PaymentStatus {
  const refunds = p.payment_refunds ?? [];
  const invoices = p.invoices ?? [];
  const unused = Number(p.unused_amount ?? 0);
  const amount = Number(p.amount ?? 0);
  if (refunds.length > 0) {
    const reasons = refunds.map((r) => r.description ?? r.reason ?? "").filter(Boolean).join("; ");
    return { status: `BOUNCED — ${reasons}`, invoice: "none — refunded" };
  }
  if (invoices.length > 0) {
    const nums = invoices.map((i) => i.invoice_number).filter(Boolean).join(", ");
    return { status: "Applied", invoice: nums || "(linked, no number)" };
  }
  if (unused >= amount - 0.5 && amount > 0) {
    return { status: "Unapplied (sitting as advance)", invoice: "none — not yet applied" };
  }
  if (unused > 0) return { status: "Partially applied", invoice: "(see Books)" };
  return { status: "Used (no invoice on record)", invoice: "(see Books)" };
}

export interface MatchRow {
  payment_id: string;
  payment_number: string | null;
  date: string | null;
  customer: string | null;
  amount: number | null;
  reference_number: string | null;
  unused_amount: number | null;
  status: string;
  invoice: string;
  rejected_reason?: string;
}

function rowFromPayment(p: ZohoPaymentFull, status: PaymentStatus): MatchRow {
  return {
    payment_id: p.payment_id ?? "",
    payment_number: p.payment_number ?? null,
    date: p.date ?? null,
    customer: p.customer_name ?? null,
    amount: typeof p.amount === "number" ? p.amount : null,
    reference_number: p.reference_number ?? null,
    unused_amount: typeof p.unused_amount === "number" ? p.unused_amount : null,
    status: status.status,
    invoice: status.invoice,
  };
}

export interface LookupResult {
  matches: MatchRow[];
  rejected: MatchRow[];
  total_candidates: number;
}

// ----- create customer payment (port of cheque_lookup.py:create_customer_payment) -----

interface ZohoCustomerContact {
  contact_id?: string;
  contact_name?: string;
}

async function findCustomerByName(token: string, vendorName: string): Promise<ZohoCustomerContact | null> {
  if (!vendorName) return null;
  const search = async (query: string): Promise<ZohoCustomerContact[]> => {
    const json = await zohoGet<{ contacts?: ZohoCustomerContact[] }>(
      token,
      "contacts",
      { contact_name_contains: query, contact_type: "customer", per_page: "50" },
    );
    return json.contacts ?? [];
  };

  let candidates = await search(vendorName);
  if (candidates.length === 0) {
    const firstWord = vendorName.split(/\s+/).find((w) => w.length >= 4);
    if (firstWord && firstWord.toLowerCase() !== vendorName.toLowerCase()) {
      candidates = await search(firstWord);
    }
  }
  const matches = candidates.filter((c) => nameMatches(vendorName, c.contact_name));
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.contact_name?.length ?? 0) - (b.contact_name?.length ?? 0));
  return matches[0];
}

export type CreatePaymentResult =
  | { ok: true; payment_id: string; payment_number: string; customer_name: string; message: string }
  | { ok: false; code: "missing_fields" | "duplicate" | "no_customer_match" | "api_error"; error: string; existing?: ZohoPaymentListItem[] };

export async function createCustomerPayment(args: {
  vendorName: string;
  chequeNo: string;
  chequeDate: string;
  amount: number;
  checkDuplicates?: boolean;
}): Promise<CreatePaymentResult> {
  const { vendorName, chequeNo, chequeDate, amount } = args;
  const checkDuplicates = args.checkDuplicates ?? true;

  if (!vendorName || !chequeNo || !chequeDate || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      code: "missing_fields",
      error: "vendor_name, cheque_no, cheque_date and a positive amount are all required",
    };
  }

  const token = await getAccessToken();
  const chequeInHandAccountId = config.zoho.chequeInHandAccountId;
  if (!chequeInHandAccountId) {
    return { ok: false, code: "api_error", error: "ZOHO_BOOKS_CHEQUE_IN_HAND_ACCOUNT_ID is not set" };
  }

  if (checkDuplicates) {
    let existing = await searchPaymentsByCheque(token, chequeNo);
    const cd = parseIsoDate(chequeDate);
    if (cd) {
      existing = existing.filter((p) => {
        const pd = parseIsoDate(p.date ?? null);
        return pd !== null && pd.getTime() === cd.getTime();
      });
    }
    if (existing.length > 0) {
      const nums = existing.map((p) => p.payment_number ?? "?").join(", ");
      return {
        ok: false,
        code: "duplicate",
        error: `Payment(s) with reference '${chequeNo}' on ${chequeDate} already exist in Zoho: ${nums}`,
        existing,
      };
    }
  }

  const customer = await findCustomerByName(token, vendorName);
  if (!customer || !customer.contact_id) {
    return {
      ok: false,
      code: "no_customer_match",
      error: `No Zoho customer matched vendor name "${vendorName}".`,
    };
  }

  const body = {
    customer_id: customer.contact_id,
    payment_mode: "Cheque",
    amount,
    date: chequeDate,
    reference_number: chequeNo,
    account_id: chequeInHandAccountId,
  };
  const url = `${apiBase()}/books/v3/customerpayments?organization_id=${encodeURIComponent(orgId())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status !== 200 && res.status !== 201) {
    const text = await res.text();
    return { ok: false, code: "api_error", error: `Zoho API ${res.status}: ${text.slice(0, 400)}` };
  }
  const json = (await res.json()) as { payment?: { payment_id?: string; payment_number?: string } };
  const payment = json.payment ?? {};
  const customerName = customer.contact_name ?? vendorName;
  return {
    ok: true,
    payment_id: payment.payment_id ?? "",
    payment_number: payment.payment_number ?? "",
    customer_name: customerName,
    message: `Created payment ${payment.payment_number ?? ""} for ${customerName} (unapplied)`,
  };
}

export async function lookupPaymentsForCheque(args: {
  chequeNo: string;
  chequeDate: string | null;
  amount: number | null;
  vendorName: string | null;
}): Promise<LookupResult> {
  const token = await getAccessToken();
  const all = await searchPaymentsByCheque(token, args.chequeNo);

  // Filter by date window if we have a cheque date.
  const cd = parseIsoDate(args.chequeDate);
  let candidates = all;
  if (cd) {
    const lo = cd.getTime() - DATE_WINDOW_DAYS_BEFORE * 86_400_000;
    const hi = cd.getTime() + DATE_WINDOW_DAYS_AFTER * 86_400_000;
    candidates = all.filter((p) => {
      const pd = parseIsoDate(p.date ?? null);
      return pd !== null && pd.getTime() >= lo && pd.getTime() <= hi;
    });
    // Sort by absolute proximity to the cheque date.
    candidates.sort((a, b) => {
      const ad = parseIsoDate(a.date ?? null)?.getTime() ?? 0;
      const bd = parseIsoDate(b.date ?? null)?.getTime() ?? 0;
      return Math.abs(ad - cd.getTime()) - Math.abs(bd - cd.getTime());
    });
  }

  // Hard cap to keep latency bounded even if Zoho returns a long tail of
  // partial-reference matches. 20 candidates × ~200 ms = ~4 s worst-case.
  const MAX_ENRICH = 20;
  const work = candidates.filter((p) => !!p.payment_id).slice(0, MAX_ENRICH);

  // Parallel fetch of full payment records (was sequential — the big win).
  const fulls = await Promise.all(work.map((p) => getPaymentFull(token, p.payment_id!)));

  const matches: MatchRow[] = [];
  const rejected: MatchRow[] = [];
  for (const full of fulls) {
    const status = determineStatus(full);
    const row = rowFromPayment(full, status);
    const zAmount = typeof full.amount === "number" ? full.amount : null;
    const amountOk =
      args.amount !== null && zAmount !== null && Math.abs(zAmount - args.amount) <= AMOUNT_TOLERANCE_RUPEES;
    const vendorOk = nameMatches(args.vendorName, full.customer_name);
    const reasons: string[] = [];
    if (!amountOk) reasons.push(`amount ₹${zAmount ?? "?"} ≠ ₹${args.amount ?? "?"}`);
    if (!vendorOk) reasons.push(`customer "${full.customer_name ?? ""}" ≠ vendor "${args.vendorName ?? ""}"`);
    if (reasons.length > 0) {
      rejected.push({ ...row, rejected_reason: reasons.join("; ") });
    } else {
      matches.push(row);
    }
  }
  return { matches, rejected, total_candidates: all.length };
}
