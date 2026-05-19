export type JobState = "uploaded" | "sending" | "done" | "error";
export type VendorStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface VendorRow {
  name: string;
  intended_email: string;
  file: string;
  has_email: boolean;
  status: VendorStatus;
  error: string | null;
}

export interface Job {
  job_id: string;
  created_at: string;
  source_filename: string;
  state: JobState;
  total: number;
  sent: number;
  failed: number;
  period_label: string;
  vendors: VendorRow[];
  error?: string;
}

export interface Preview {
  filename: string;
  title: string;
  subtitle: string;
  header: Array<string | number | null>;
  rows: Array<Array<string | number | null>>;
  total: Array<string | number | null>;
}
