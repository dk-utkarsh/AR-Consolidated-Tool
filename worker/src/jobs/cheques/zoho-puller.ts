import { config } from "../../lib/config";
import { writeJsonFile, workerDiskPath } from "../../lib/store";
import { log } from "../../lib/logger";

// Mirrors pull_zoho_account_transactions.py exactly: same report, same columns.

const FROM_DATE = process.env.CHEQUES_FROM_DATE ?? "2026-04-01";
const TO_DATE = process.env.CHEQUES_TO_DATE ?? "2027-03-31";
const PER_PAGE = 200;

const ACCOUNT_ID = config.zoho.chequeInHandAccountId ?? "2524339000010017831";
const CUSTOM_REPORT_ID = process.env.ZOHO_BOOKS_CHEQUE_CUSTOM_REPORT_ID ?? "2524339000036410013";

const DISK_RELATIVE = "cheques/transactions.json";

interface RawRow {
  date?: string;
  transaction_date?: string;
  account_name?: string;
  transaction_details?: string;
  description?: string;
  transaction_type?: string;
  transaction_type_formatted?: string;
  entity_number?: string;
  transaction_number?: string;
  reference_number?: string;
  debit?: string;
  debit_amount?: string;
  credit?: string;
  credit_amount?: string;
  net_amount?: string;
  amount?: string;
}

export interface ChequeTransaction {
  date: string;
  account_name: string;
  transaction_details: string;
  transaction_type: string;
  entity_number: string;
  reference_number: string;
  debit: string;
  credit: string;
  net_amount: string;
}

function tokenUrl(): string {
  const tld = config.zoho.apiDomain.split(".").pop() ?? "in";
  return `https://accounts.zoho.${tld}/oauth/v2/token`;
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = config.zoho;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho creds missing");
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(tokenUrl(), { method: "POST", body });
  const json = (await res.json()) as { access_token?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

interface PagePayload {
  page_context?: { has_more_page?: boolean };
  [k: string]: unknown;
}

async function fetchPage(token: string, page: number): Promise<PagePayload> {
  const orgId = config.zoho.organizationId;
  if (!orgId) throw new Error("ZOHO_BOOKS_ORGANIZATION_ID is not set");
  const qs = new URLSearchParams({
    organization_id: orgId,
    custom_report_id: CUSTOM_REPORT_ID,
    from_date: FROM_DATE,
    to_date: TO_DATE,
    filter_by: "TransactionDate.CustomDate",
    cash_based: "false",
    page: String(page),
    per_page: String(PER_PAGE),
    sort_column: "date",
    sort_order: "A",
  });
  const url = `${config.zoho.apiDomain}/books/v3/reports/accounttransaction?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Report fetch failed HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json() as Promise<PagePayload>;
}

const ROW_SIGNALS = ["debit", "credit", "transaction_type", "transaction_id"];

function looksLikeRows(v: unknown): v is RawRow[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  const head = v[0];
  if (typeof head !== "object" || head === null) return false;
  return ROW_SIGNALS.some((k) => k in (head as Record<string, unknown>));
}

function findRows(node: unknown): RawRow[] {
  if (looksLikeRows(node)) return node;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findRows(item);
      if (hit.length) return hit;
    }
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      const hit = findRows(v);
      if (hit.length) return hit;
    }
  }
  return [];
}

function normalise(r: RawRow): ChequeTransaction {
  return {
    date: r.date ?? r.transaction_date ?? "",
    account_name: r.account_name ?? "",
    transaction_details: r.transaction_details ?? r.description ?? "",
    transaction_type: r.transaction_type ?? r.transaction_type_formatted ?? "",
    entity_number: r.entity_number ?? r.transaction_number ?? "",
    reference_number: r.reference_number ?? "",
    debit: r.debit ?? r.debit_amount ?? "",
    credit: r.credit ?? r.credit_amount ?? "",
    net_amount: r.net_amount ?? r.amount ?? "",
  };
}

export interface PullResult {
  rows: number;
  pulledAt: string;
  fromDate: string;
  toDate: string;
  accountId: string;
}

export async function pullChequeTransactions(): Promise<PullResult> {
  log.info("cheques.pull.start", { from: FROM_DATE, to: TO_DATE });
  const token = await getAccessToken();
  const all: RawRow[] = [];
  let page = 1;
  for (;;) {
    const payload = await fetchPage(token, page);
    const rows = findRows(payload);
    if (rows.length === 0) {
      if (page === 1) {
        log.warn("cheques.pull.no_rows");
        return { rows: 0, pulledAt: new Date().toISOString(), fromDate: FROM_DATE, toDate: TO_DATE, accountId: ACCOUNT_ID };
      }
      break;
    }
    all.push(...rows);
    const ctx = payload.page_context ?? {};
    const hasMore = ctx.has_more_page ?? rows.length >= PER_PAGE;
    log.info("cheques.pull.page", { page, rows: rows.length, total: all.length });
    if (!hasMore) break;
    page += 1;
  }
  const normalised = all.map(normalise);
  const result: PullResult = {
    rows: normalised.length,
    pulledAt: new Date().toISOString(),
    fromDate: FROM_DATE,
    toDate: TO_DATE,
    accountId: ACCOUNT_ID,
  };
  writeJsonFile(DISK_RELATIVE, { meta: result, rows: normalised });
  log.info("cheques.pull.done", { rows: normalised.length });
  return result;
}

export function transactionsDiskPath(): string {
  return workerDiskPath(DISK_RELATIVE);
}
