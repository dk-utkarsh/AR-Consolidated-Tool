import { config } from "./config";

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
  transaction_id?: string;
  transaction_type?: string;
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

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    refresh_token: config.zoho.refreshToken,
    client_id: config.zoho.clientId,
    client_secret: config.zoho.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(`${config.zoho.tokenUrl}?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function zohoGet<T = unknown>(
  url: string,
  token: string,
  params: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${url}?${qs.toString()}`, {
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho GET ${url} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

const PER_PAGE = 200;

export async function fetchAllUncategorized(token: string): Promise<BankTransaction[]> {
  const url = `${config.zoho.apiDomain}/books/v3/banktransactions`;
  const all: BankTransaction[] = [];
  let page = 1;
  while (true) {
    const payload = await zohoGet<{
      banktransactions?: BankTransaction[];
      page_context?: { has_more_page?: boolean };
    }>(url, token, {
      organization_id: config.zoho.organizationId,
      account_id: config.zoho.uncategorizedAccountId,
      filter_by: "Status.Uncategorized",
      per_page: PER_PAGE,
      page,
      sort_column: "date",
      sort_order: "D",
    });
    const rows = payload.banktransactions ?? [];
    all.push(...rows);
    if (!payload.page_context?.has_more_page) break;
    page += 1;
  }
  return all;
}

export async function fetchLedger(
  token: string,
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<LedgerTransaction[]> {
  const url = `${config.zoho.apiDomain}/books/v3/chartofaccounts/transactions`;
  const all: LedgerTransaction[] = [];
  let page = 1;
  while (true) {
    const payload = await zohoGet<{
      transactions?: LedgerTransaction[];
      page_context?: { has_more_page?: boolean };
    }>(url, token, {
      organization_id: config.zoho.organizationId,
      account_id: accountId,
      from_date: fromDate,
      to_date: toDate,
      per_page: PER_PAGE,
      page,
      sort_column: "transaction_date",
      sort_order: "D",
    });
    const rows = payload.transactions ?? [];
    all.push(...rows);
    if (!payload.page_context?.has_more_page) break;
    page += 1;
  }
  await enrichWithDescriptions(token, all);
  return all;
}

const DESCRIPTION_ENDPOINT_BY_TYPE: Record<
  string,
  { path: string; wrapper: string }
> = {
  expense: { path: "expenses", wrapper: "expense" },
  expense_refund: { path: "banktransactions", wrapper: "banktransaction" },
  transfer_fund: { path: "banktransactions", wrapper: "banktransaction" },
  deposit: { path: "banktransactions", wrapper: "banktransaction" },
  withdrawal: { path: "banktransactions", wrapper: "banktransaction" },
  card_charge: { path: "banktransactions", wrapper: "banktransaction" },
  card_payment: { path: "banktransactions", wrapper: "banktransaction" },
};

async function fetchUnderlyingDescription(
  token: string,
  txnId: string,
  txnType: string,
): Promise<string | null> {
  const mapping = DESCRIPTION_ENDPOINT_BY_TYPE[txnType];
  if (!mapping) return null;
  try {
    const data = await zohoGet<Record<string, unknown>>(
      `${config.zoho.apiDomain}/books/v3/${mapping.path}/${txnId}`,
      token,
      { organization_id: config.zoho.organizationId },
    );
    const wrapped = data[mapping.wrapper] as
      | { description?: unknown }
      | undefined;
    const desc = wrapped?.description;
    return typeof desc === "string" && desc.trim() ? desc : null;
  } catch {
    return null;
  }
}

async function enrichWithDescriptions(
  token: string,
  rows: LedgerTransaction[],
): Promise<void> {
  const CONCURRENCY = 15;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        if (typeof row.description === "string" && row.description.trim()) return;
        const txnId = row.transaction_id;
        const txnType = row.transaction_type;
        if (!txnId || !txnType) return;
        const desc = await fetchUnderlyingDescription(token, txnId, txnType);
        if (desc) row.description = desc;
      }),
    );
  }
}

export interface CustomerSummary {
  contact_id: string;
  contact_name: string;
  outstanding_receivable_amount?: number;
}

export async function fetchCustomers(
  token: string,
  search: string,
): Promise<CustomerSummary[]> {
  const params: Record<string, string | number> = {
    organization_id: config.zoho.organizationId,
    contact_type: "customer",
    per_page: 50,
    sort_column: "contact_name",
    sort_order: "A",
  };
  if (search.trim()) params.contact_name_contains = search.trim();
  const payload = await zohoGet<{ contacts?: CustomerSummary[] }>(
    `${config.zoho.apiDomain}/books/v3/contacts`,
    token,
    params,
  );
  return (payload.contacts ?? []).map((c) => ({
    contact_id: c.contact_id,
    contact_name: c.contact_name,
    outstanding_receivable_amount: c.outstanding_receivable_amount,
  }));
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

export async function fetchOpenInvoices(
  token: string,
  customerId: string,
): Promise<OpenInvoice[]> {
  const all: OpenInvoice[] = [];
  for (const status of ["unpaid", "partially_paid"]) {
    let page = 1;
    while (true) {
      const payload = await zohoGet<{
        invoices?: OpenInvoice[];
        page_context?: { has_more_page?: boolean };
      }>(`${config.zoho.apiDomain}/books/v3/invoices`, token, {
        organization_id: config.zoho.organizationId,
        customer_id: customerId,
        status,
        per_page: 200,
        page,
        sort_column: "date",
        sort_order: "D",
      });
      all.push(...(payload.invoices ?? []));
      if (!payload.page_context?.has_more_page) break;
      page += 1;
    }
  }
  return all.map((inv) => ({
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
    date: inv.date,
    due_date: inv.due_date,
    total: Number(inv.total) || 0,
    balance: Number(inv.balance) || 0,
    status: inv.status,
    reference_number: inv.reference_number,
  }));
}

export interface LocationSummary {
  location_id: string;
  location_name: string;
}

export async function fetchLocations(
  token: string,
): Promise<LocationSummary[]> {
  const payload = await zohoGet<{ locations?: LocationSummary[] }>(
    `${config.zoho.apiDomain}/books/v3/locations`,
    token,
    { organization_id: config.zoho.organizationId },
  );
  return (payload.locations ?? []).map((l) => ({
    location_id: l.location_id,
    location_name: l.location_name,
  }));
}

export interface CategorizeAsCustomerPaymentBody {
  customer_id: string;
  payment_mode: string;
  amount: number;
  date: string;
  reference_number?: string;
  description?: string;
  location_id?: string;
  invoices: Array<{ invoice_id: string; amount_applied: number }>;
  /** Optional override; defaults to ZOHO_BOOKS_UNCATEGORIZED_ACCOUNT_ID (ICICI Bank-1286). */
  account_id?: string;
}

export async function categorizeAsCustomerPayment(
  token: string,
  bankTxnId: string,
  body: CategorizeAsCustomerPaymentBody,
): Promise<Record<string, unknown>> {
  // Per Zoho docs the field is `account_id` (deposit-to bank/cash account).
  // Default to the uncategorized bank account the txn already lives in.
  const payload: CategorizeAsCustomerPaymentBody = {
    ...body,
    account_id: body.account_id ?? config.zoho.uncategorizedAccountId,
  };
  const url = `${config.zoho.apiDomain}/books/v3/banktransactions/uncategorized/${bankTxnId}/categorize/customerpayments?organization_id=${config.zoho.organizationId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    // Log the body we sent so the api-dev terminal shows what Zoho rejected.
    console.error(
      `[zoho] categorize failed ${res.status} bank_txn=${bankTxnId} body=${JSON.stringify(payload)} response=${txt.slice(0, 600)}`,
    );
    throw new Error(`Zoho categorize failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as Record<string, unknown>;
}
