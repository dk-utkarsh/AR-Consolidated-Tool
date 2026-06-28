// Compliance proxy — forwards the Compliance tab's work to the Python GST
// engine (FastAPI) and maps its responses back into the exact shapes the
// worker's /compliance/* routes already return. This replaces the in-process
// TS engine (report.ts / reconcile.ts), which OOM'd on large workbooks; the
// Python side reads 100MB+ sales files with calamine in bounded memory.
//
// Nothing about the worker's public API changes — only where the work runs.
import fs from "node:fs";
import { openAsBlob } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../../lib/config";
import type { ComplianceResult } from "./report";
import type { RecoResult } from "../gst2b/reconcile";

const PY = config.compliancePyUrl;

// The 17 annexure descriptions, in order — same text the TS engine used, so the
// frontend table reads identically. Python returns only flat counts/values
// (annexure_N_count / annexure_N_value); we pair them back with these.
const ANNEXURE_DESCRIPTIONS: string[] = [
  "E-Invoice With Tax Invoice Total Val. Not Matched",
  "B2B Invoices Missing in E-Invoice Data",
  "E-Invoices Missing in Sales Data",
  "Sales Invoices >= 50K Missing in E-way Bill",
  "E-Invoices >= 50K Missing in E-way Bill",
  "E-way Bills Missing in Sales Data",
  "E-way Bills (with GST) Missing in E-Invoice",
  "TES SKU Invoices with E-Invoice/E-way Bill",
  "Administration Order Channel Records",
  "High Discount Records (>= 90%)",
  "Zero OrderAmount Invoices",
  "E-Invoice CDNR Missing in Credit Note",
  "Credit Notes (with GST) Missing in CDNR",
  "Credit Notes >= 50K Missing in E-way Bill Inward",
  "E-Invoice CDNR >= 50K Missing in E-way Bill Inward",
  "E-way Bill Inward Missing in Credit Note",
  "E-Invoice CDNR vs Credit Note Value Mismatch",
];

export type Progress = (pct: number, msg: string) => void;

interface PyAnalyzeAck { job_id?: string; status?: string; error?: string; success?: boolean }
interface PyStatus {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  pct: number;
  msg: string;
  result: PyResult | null;
}
interface PyResult {
  success: boolean;
  filename?: string;
  error?: string;
  summary?: Record<string, number>;
}

/** Append an on-disk file to a FormData as a streamed Blob (no full read into
 *  the heap — openAsBlob memory-maps lazily, so a 128MB upload stays flat). */
async function appendFile(fd: FormData, field: string, filePath: string): Promise<void> {
  const blob = await openAsBlob(filePath);
  fd.append(field, blob, path.basename(filePath));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Stream a Python /download response straight to a file on the worker disk so
 *  the existing /compliance download routes can serve it unchanged. */
async function downloadToFile(urlPath: string, destPath: string): Promise<void> {
  const res = await fetch(`${PY}${urlPath}`);
  if (!res.ok || !res.body) {
    throw new Error(`failed to fetch report from compliance engine (HTTP ${res.status})`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(destPath));
}

/** Build the worker's ComplianceResult.summary from Python's flat api_summary. */
function mapSummary(py: Record<string, number>): ComplianceResult["summary"] {
  const annexures = ANNEXURE_DESCRIPTIONS.map((desc, i) => {
    const n = i + 1;
    return {
      key: `Annexure ${n}`,
      description: desc,
      records: Number(py[`annexure_${n}_count`] ?? 0),
      value: Number(py[`annexure_${n}_value`] ?? 0),
    };
  });
  return {
    total_sales_records: Number(py.total_sales_records ?? 0),
    total_einvoice_records: Number(py.total_einvoice_records ?? 0),
    annexures,
  };
}

export interface CompliancePyInputs {
  sales: string;
  einvoice: string;
  ewaybill?: string | null;
  creditnote?: string | null;
  cnEinvoice?: string | null;
}

/**
 * Run a full compliance analysis on the Python engine. Uploads the files,
 * polls progress (relayed via onProgress), then downloads the finished report
 * into `outDir` and returns the worker-shaped ComplianceResult.
 */
export async function runComplianceViaPython(
  inputs: CompliancePyInputs,
  outDir: string,
  onProgress: Progress = () => {},
): Promise<ComplianceResult> {
  const fd = new FormData();
  await appendFile(fd, "sales_file", inputs.sales);
  await appendFile(fd, "einvoice_file", inputs.einvoice);
  if (inputs.ewaybill) await appendFile(fd, "ewaybill_file", inputs.ewaybill);
  if (inputs.creditnote) await appendFile(fd, "creditnote_file", inputs.creditnote);
  if (inputs.cnEinvoice) await appendFile(fd, "cn_einvoice_file", inputs.cnEinvoice);

  let ack: PyAnalyzeAck;
  try {
    const res = await fetch(`${PY}/analyze`, { method: "POST", body: fd });
    ack = (await res.json()) as PyAnalyzeAck;
  } catch (e) {
    throw new Error(`compliance engine unreachable at ${PY} — is the Python service running? (${(e as Error).message})`);
  }
  if (!ack.job_id) throw new Error(ack.error || "compliance engine did not start the job");

  const jobId = ack.job_id;
  // Poll until done/error. The engine does heavy pandas/xlsxwriter work in a
  // background thread; while it holds Python's GIL (notably the "Writing Excel
  // report" phase) its async server is briefly starved, so an individual
  // /status poll can fail transiently even though the job is fine and about to
  // finish. So tolerate transient fetch failures and keep waiting — only give
  // up after a *sustained* outage (the engine truly died) or the hard deadline.
  // A genuine 404 (job unknown) means the engine restarted and lost the job,
  // which is terminal.
  const POLL_INTERVAL_MS = 1500;
  const POLL_TIMEOUT_MS = 20_000;
  const MAX_CONSECUTIVE_FAILURES = 80; // ~several minutes of continuous unreachability
  const HARD_DEADLINE_MS = 30 * 60 * 1000;
  const startedAt = Date.now();
  let consecutiveFailures = 0;
  let lastErr = "";

  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      throw new Error("compliance analysis timed out (engine did not finish in 30 minutes)");
    }

    let res: Response;
    try {
      res = await fetch(`${PY}/status/${encodeURIComponent(jobId)}`, {
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
    } catch (e) {
      // Network blip / timeout while the engine is busy — retry, don't abort.
      lastErr = (e as Error).message || String(e);
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`lost contact with compliance engine after ${consecutiveFailures} attempts: ${lastErr}`);
      }
      continue;
    }

    if (res.status === 404) {
      throw new Error("compliance engine lost the job (it restarted) — please try again");
    }

    let st: PyStatus;
    try {
      st = (await res.json()) as PyStatus;
    } catch (e) {
      lastErr = (e as Error).message || String(e);
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`compliance engine returned unreadable status: ${lastErr}`);
      }
      continue;
    }
    consecutiveFailures = 0; // a clean poll resets the transient-failure budget

    onProgress(Math.max(5, Number(st.pct) || 5), st.msg || "Processing...");

    if (st.status === "error") {
      throw new Error(st.result?.error || "compliance analysis failed in the engine");
    }
    if (st.status === "done") {
      const r = st.result;
      if (!r || !r.success || !r.filename || !r.summary) {
        throw new Error(r?.error || "compliance engine returned no report");
      }
      const destPath = path.join(outDir, r.filename);
      await downloadToFile(`/download/${encodeURIComponent(r.filename)}`, destPath);
      return { filename: r.filename, summary: mapSummary(r.summary) };
    }
  }
}

interface PyReco {
  success: boolean;
  error?: string;
  summary?: RecoResult["summary"];
  filename?: string;
}

/**
 * Run a GST 2B reconciliation on the Python engine (synchronous). Uploads both
 * files, downloads the result into `outDir`, and returns the worker-shaped
 * RecoResult.
 */
export async function runGst2bViaPython(
  file2b: string,
  filePr: string,
  outDir: string,
): Promise<RecoResult> {
  const fd = new FormData();
  await appendFile(fd, "file_2b", file2b);
  await appendFile(fd, "file_pr", filePr);

  let body: PyReco;
  try {
    const res = await fetch(`${PY}/gst2b/reconcile`, { method: "POST", body: fd });
    body = (await res.json()) as PyReco;
  } catch (e) {
    throw new Error(`compliance engine unreachable at ${PY} — is the Python service running? (${(e as Error).message})`);
  }
  if (!body.success || !body.filename || !body.summary) {
    throw new Error(body.error || "reconciliation failed in the engine");
  }
  const destPath = path.join(outDir, body.filename);
  await downloadToFile(`/gst2b/download/${encodeURIComponent(body.filename)}`, destPath);
  return { success: true, summary: body.summary, filename: body.filename };
}
