import { useState } from "react";
import {
  reconcile, downloadResult, downloadGst2bSample,
  type RecoResponse, type Gst2bSampleKind,
} from "../gst2bApi";

function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}
function fmtMoney(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

interface StatCardProps {
  label: string;
  count: number;
  taxable: number;
  tone: "green" | "red" | "yellow" | "blue";
}

const TONES: Record<StatCardProps["tone"], string> = {
  green: "border-emerald-200 bg-emerald-50",
  red: "border-rose-200 bg-rose-50",
  yellow: "border-amber-200 bg-amber-50",
  blue: "border-sky-200 bg-sky-50",
};

function StatCard({ label, count, taxable, tone }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${TONES[tone]}`}>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{fmtInt(count)}</div>
      <div className="text-xs text-slate-500">Taxable ₹{fmtMoney(taxable)}</div>
    </div>
  );
}

export default function Gst2bReco() {
  const [file2b, setFile2b] = useState<File | null>(null);
  const [filePr, setFilePr] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoResponse | null>(null);
  const [downloading, setDownloading] = useState(false);

  const run = async () => {
    if (!file2b || !filePr) {
      setError("Both the GSTR-2B file and the Purchase Register are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await reconcile(file2b, filePr));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sample = (kind: Gst2bSampleKind) =>
    downloadGst2bSample(kind).catch((e) => setError((e as Error).message));

  const onDownload = async () => {
    if (!result) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadResult(result.filename);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">GST 2B Reconciliation</h2>
          <p className="text-xs text-slate-500">
            Match your Purchase Register against the GSTR-2B by GSTIN + Invoice No (±₹1 tolerance).
          </p>
        </div>
        {result && (
          <button onClick={() => { setResult(null); setError(null); }} className="text-sm text-slate-500 hover:text-slate-700">
            Start over
          </button>
        )}
      </div>

      {!result && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <div className="w-44 shrink-0 text-sm font-medium text-slate-700">GSTR-2B file<span className="text-rose-500"> *</span></div>
            <input type="file" accept=".xlsx,.xls" className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
              onChange={(e) => setFile2b(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => sample("gstr2b")} className="ml-auto text-xs text-indigo-600 hover:text-indigo-800">sample</button>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <div className="w-44 shrink-0 text-sm font-medium text-slate-700">Purchase Register<span className="text-rose-500"> *</span></div>
            <input type="file" accept=".xlsx,.xls" className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
              onChange={(e) => setFilePr(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => sample("purchase")} className="ml-auto text-xs text-indigo-600 hover:text-indigo-800">sample</button>
          </div>
          <div className="flex justify-end">
            <button disabled={busy} onClick={run}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
              {busy ? "Reconciling…" : "Reconcile"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Matched" tone="green" count={result.summary.matched_count} taxable={result.summary.matched_taxable} />
            <StatCard label="Mismatched" tone="red" count={result.summary.mismatched_count} taxable={result.summary.mismatched_2b_taxable} />
            <StatCard label="Not in 2B (only Books)" tone="yellow" count={result.summary.not_in_2b_count} taxable={result.summary.not_in_2b_taxable} />
            <StatCard label="Not in Books (only 2B)" tone="blue" count={result.summary.not_in_books_count} taxable={result.summary.not_in_books_taxable} />
          </div>
          <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {fmtInt(result.summary.total_2b_records)} 2B records · {fmtInt(result.summary.total_pr_records)} purchase records
            </div>
            <button onClick={onDownload} disabled={downloading}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:bg-slate-300 transition">
              {downloading ? "Preparing…" : "Download Report"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
