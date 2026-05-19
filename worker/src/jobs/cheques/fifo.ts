import fs from "node:fs";
import { transactionsDiskPath, type ChequeTransaction, type PullResult } from "./zoho-puller";

// Port of dashboard.py: load_csv, _to_float, _parse_net_amount, fifo_match,
// build_vendor_summary, days_to_clear logic. Same semantics, JSON-on-disk store.

function toFloat(x: unknown): number {
  if (x === null || x === undefined || x === "") return 0;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const n = Number(String(x));
  return Number.isFinite(n) ? n : 0;
}

function parseNetAmount(s: unknown): { value: number; side: "" | "cr" | "dr" } {
  if (s === null || s === undefined) return { value: 0, side: "" };
  const parts = String(s).trim().replace(/,/g, "").split(/\s+/);
  if (parts.length === 0) return { value: 0, side: "" };
  const val = Number(parts[0]);
  if (!Number.isFinite(val)) return { value: 0, side: "" };
  const sideRaw = (parts[1] ?? "").toLowerCase();
  const side: "" | "cr" | "dr" = sideRaw === "cr" ? "cr" : sideRaw === "dr" ? "dr" : "";
  return { value: val, side };
}

function parseIsoDate(s: string | undefined): string | null {
  // Accept "YYYY-MM-DD" or anything Date can parse and normalise to YYYY-MM-DD.
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  // Use the UTC components to avoid TZ shifts on bare dates.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00Z`).getTime();
  const bd = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((ad - bd) / 86_400_000);
}

export interface EnrichedRow {
  date: string;                        // YYYY-MM-DD (normalised)
  vendor: string;
  reference_number: string;
  transaction_type: string;
  entity_number: string;
  debit_amt: number;
  credit_amt: number;
  net_amount: string;
  net_amount_val: number;
  net_amount_side: "" | "cr" | "dr";
}

export interface OpenDebit extends EnrichedRow {
  outstanding: number;
  paid_amount: number;
  status: "Paid" | "Partial" | "Open";
  days_to_clear: number | null;
}

export interface ClosedCase {
  date: string;
  customer: string;
  transaction_type: string;
  credit_amount: number;
  unmatched_credit: number;
  net_amount: string;
  reference_number: string;
}

export interface CustomerSummary {
  customer: string;
  status: "Paid" | "Outstanding";
  total_issued: number;
  total_cleared: number;
  balance_outstanding: number;
  overdue: number;
  due_in_2d: number;
  due_in_6d: number;
  due_in_15d: number;
  open_cheques: number;
  total_cheques: number;
}

function loadEnriched(): { rows: EnrichedRow[]; meta: PullResult | null } {
  const path = transactionsDiskPath();
  if (!fs.existsSync(path)) return { rows: [], meta: null };
  const parsed = JSON.parse(fs.readFileSync(path, "utf8")) as {
    meta: PullResult;
    rows: ChequeTransaction[];
  };
  const enriched: EnrichedRow[] = parsed.rows.map((r) => {
    const net = parseNetAmount(r.net_amount);
    return {
      date: parseIsoDate(r.date) ?? "",
      vendor: (r.transaction_details ?? "").trim(),
      reference_number: r.reference_number ?? "",
      transaction_type: r.transaction_type ?? "",
      entity_number: r.entity_number ?? "",
      debit_amt: toFloat(r.debit),
      credit_amt: toFloat(r.credit),
      net_amount: r.net_amount ?? "",
      net_amount_val: net.value,
      net_amount_side: net.side,
    };
  });
  return { rows: enriched, meta: parsed.meta };
}

export interface MatchResult {
  debits: OpenDebit[];
  orphans: ClosedCase[];
  autoClosed: ClosedCase[];
}

function fifoMatch(rows: EnrichedRow[]): MatchResult {
  const debits: OpenDebit[] = rows
    .filter((r) => r.debit_amt > 0)
    .map((r) => ({
      ...r,
      outstanding: r.debit_amt,
      paid_amount: 0,
      status: "Open" as const,
      days_to_clear: null,
    }))
    .sort((a, b) => (a.vendor === b.vendor ? a.date.localeCompare(b.date) : a.vendor.localeCompare(b.vendor)));

  const credits = rows
    .filter((r) => r.credit_amt > 0)
    .sort((a, b) => (a.vendor === b.vendor ? a.date.localeCompare(b.date) : a.vendor.localeCompare(b.vendor)));

  const debitIdxByVendor = new Map<string, number[]>();
  debits.forEach((d, i) => {
    const arr = debitIdxByVendor.get(d.vendor);
    if (arr) arr.push(i);
    else debitIdxByVendor.set(d.vendor, [i]);
  });

  const orphans: ClosedCase[] = [];
  const autoClosed: ClosedCase[] = [];

  for (const c of credits) {
    let remaining = c.credit_amt;
    const debitIdxs = debitIdxByVendor.get(c.vendor) ?? [];
    for (const di of debitIdxs) {
      if (remaining <= 0) break;
      const d = debits[di];
      if (d.outstanding <= 0) continue;
      const applied = Math.min(d.outstanding, remaining);
      d.outstanding -= applied;
      d.paid_amount += applied;
      remaining -= applied;
    }
    if (remaining > 0) {
      const selfClosed =
        c.net_amount_side === "cr" &&
        Math.abs(c.net_amount_val - c.credit_amt) < 0.005;
      const cas: ClosedCase = {
        date: c.date,
        customer: c.vendor,
        transaction_type: c.transaction_type,
        credit_amount: c.credit_amt,
        unmatched_credit: remaining,
        net_amount: c.net_amount,
        reference_number: c.reference_number,
      };
      (selfClosed ? autoClosed : orphans).push(cas);
    }
  }

  for (const d of debits) {
    if (d.outstanding <= 0.005) d.status = "Paid";
    else if (d.paid_amount > 0.005) d.status = "Partial";
    else d.status = "Open";
  }

  return { debits, orphans, autoClosed };
}

function enrichDays(debits: OpenDebit[], asOf: string): void {
  for (const d of debits) {
    d.days_to_clear = d.date ? daysBetween(d.date, asOf) : null;
  }
}

function buildSummary(debits: OpenDebit[]): CustomerSummary[] {
  const byVendor = new Map<string, OpenDebit[]>();
  for (const d of debits) {
    const arr = byVendor.get(d.vendor);
    if (arr) arr.push(d);
    else byVendor.set(d.vendor, [d]);
  }
  const out: CustomerSummary[] = [];
  for (const [vendor, grp] of byVendor) {
    const total_debit = grp.reduce((s, r) => s + r.debit_amt, 0);
    const total_paid = grp.reduce((s, r) => s + r.paid_amount, 0);
    const outstanding = grp.reduce((s, r) => s + r.outstanding, 0);
    const openGrp = grp.filter((r) => r.outstanding > 0.005);

    const overdue = openGrp.filter((r) => (r.days_to_clear ?? Infinity) < 0)
      .reduce((s, r) => s + r.outstanding, 0);
    const inRange = (max: number) => openGrp.filter((r) => {
      const dtc = r.days_to_clear ?? -Infinity;
      return dtc >= 0 && dtc <= max;
    }).reduce((s, r) => s + r.outstanding, 0);

    out.push({
      customer: vendor || "(blank)",
      status: outstanding <= 0.005 ? "Paid" : "Outstanding",
      total_issued: total_debit,
      total_cleared: total_paid,
      balance_outstanding: outstanding,
      overdue,
      due_in_2d: inRange(2),
      due_in_6d: inRange(6),
      due_in_15d: inRange(15),
      open_cheques: openGrp.length,
      total_cheques: grp.length,
    });
  }
  out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "Outstanding" ? -1 : 1;
    return b.balance_outstanding - a.balance_outstanding;
  });
  return out;
}

export interface DashboardData {
  meta: PullResult | null;
  as_of: string;
  summary: CustomerSummary[];
  open_debits: OpenDebit[];
  orphans: ClosedCase[];
  auto_closed: ClosedCase[];
}

export function buildDashboard(asOf: string): DashboardData {
  const { rows, meta } = loadEnriched();
  if (rows.length === 0) {
    return { meta, as_of: asOf, summary: [], open_debits: [], orphans: [], auto_closed: [] };
  }
  const { debits, orphans, autoClosed } = fifoMatch(rows);
  enrichDays(debits, asOf);
  const summary = buildSummary(debits);
  const open_debits = debits.filter((d) => d.outstanding > 0.005);
  return { meta, as_of: asOf, summary, open_debits, orphans, auto_closed: autoClosed };
}

export function customerDetail(asOf: string, customer: string) {
  const { rows, meta } = loadEnriched();
  if (rows.length === 0) return { meta, as_of: asOf, cheques: [] as OpenDebit[] };
  const { debits } = fifoMatch(rows);
  enrichDays(debits, asOf);
  const cheques = debits.filter((d) => d.vendor === customer);
  return { meta, as_of: asOf, cheques };
}
