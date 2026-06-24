export interface AnnexureSummary {
  key: string;
  description: string;
  records: number;
  value: number;
}

export interface ComplianceReport {
  success: true;
  filename: string;
  download_url: string;
  summary: {
    total_sales_records: number;
    total_einvoice_records: number;
    annexures: AnnexureSummary[];
  };
}

export type ComplianceState = "queued" | "running" | "done" | "error";

export interface ComplianceJob {
  job_id: string;
  created_at: string;
  state: ComplianceState;
  pct: number;
  msg: string;
  result: ComplianceReport | null;
  error: string | null;
}

export interface AnalyzeFiles {
  sales: File;
  einvoice: File;
  ewaybill?: File | null;
  creditnote?: File | null;
  cnEinvoice?: File | null;
}
