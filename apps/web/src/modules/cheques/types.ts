export interface PullMeta {
  rows: number;
  pulledAt: string;
  fromDate: string;
  toDate: string;
  accountId: string;
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

export interface OpenDebit {
  date: string;
  vendor: string;
  reference_number: string;
  transaction_type: string;
  entity_number: string;
  debit_amt: number;
  credit_amt: number;
  net_amount: string;
  net_amount_val: number;
  net_amount_side: "" | "cr" | "dr";
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

export interface DashboardData {
  meta: PullMeta | null;
  as_of: string;
  summary: CustomerSummary[];
  open_debits: OpenDebit[];
  orphans: ClosedCase[];
  auto_closed: ClosedCase[];
}

export interface CustomerDetail {
  meta: PullMeta | null;
  as_of: string;
  cheques: OpenDebit[];
}
