import { useState } from "react";
import { downloadReport } from "../api";
import type { ComplianceJob } from "../types";

interface Props {
  job: ComplianceJob;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function ResultView({ job }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (job.state === "running" || job.state === "queued") {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">{job.msg || "Working…"}</span>
          <span className="text-sm text-slate-500">{job.pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${Math.max(5, job.pct)}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">Don't close this tab until the report is ready.</p>
      </div>
    );
  }

  if (job.state === "error") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-sm text-rose-700">
        Analysis failed: {job.error ?? "unknown error"}
      </div>
    );
  }

  const result = job.result;
  if (!result) return null;
  const { summary } = result;

  const onDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadReport(job.job_id, result.filename);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-between">
        <div className="flex gap-8">
          <div>
            <div className="text-2xl font-bold text-slate-900">{fmtInt(summary.total_sales_records)}</div>
            <div className="text-xs text-slate-500">B2B sales invoices</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{fmtInt(summary.total_einvoice_records)}</div>
            <div className="text-xs text-slate-500">E-invoice records</div>
          </div>
        </div>
        <button
          onClick={onDownload}
          disabled={downloading}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:bg-slate-300 transition"
        >
          {downloading ? "Preparing…" : "Download Report"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Annexure</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Records</th>
              <th className="text-right px-4 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {summary.annexures.map((a) => (
              <tr key={a.key} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap">{a.key}</td>
                <td className="px-4 py-2 text-slate-600">{a.description}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${a.records > 0 ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                  {fmtInt(a.records)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {a.value ? fmtMoney(a.value) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
