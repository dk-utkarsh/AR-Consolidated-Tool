import { useEffect, useRef, useState } from "react";
import {
  prepare, getPrepareStatus, downloadPrepared,
  type PrepareFiles, type PrepareJob, type PreparedFileResult,
} from "../prepareApi";

interface Slot {
  key: keyof PrepareFiles;
  label: string;
  filter: string;
}

const SLOTS: Slot[] = [
  { key: "sales", label: "Sales Data", filter: "removes Cancelled/closed (Status)" },
  { key: "einvoice", label: "E-Invoice", filter: "removes Cancelled/closed (E-invoice status)" },
  { key: "creditnote", label: "Sale Return / Credit Note", filter: "removes Cancelled/closed (Order Status)" },
  { key: "cnEinvoice", label: "CN E-Invoice (CDNR)", filter: "removes Cancelled/closed (E-invoice status)" },
  { key: "ewaybill", label: "E-way Bill", filter: "no rows removed" },
];

function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}

function ResultCard({ jobId, file }: { jobId: string; file: PreparedFileResult }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-800">{file.label}</div>
        <button
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await downloadPrepared(jobId, file.filename); }
            catch (e) { setErr((e as Error).message); }
            finally { setBusy(false); }
          }}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-slate-300"
        >
          {busy ? "…" : "Download"}
        </button>
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <span className="text-emerald-700 font-semibold">{fmtInt(file.kept)} kept</span>
        <span className={file.dropped > 0 ? "text-rose-600 font-semibold" : "text-slate-400"}>
          {fmtInt(file.dropped)} removed
        </span>
        {file.status_column && (
          <span className="text-slate-400">filtered on “{file.status_column}”</span>
        )}
      </div>
      {file.blank_columns.length > 0 && (
        <div className="mt-1 text-xs text-amber-600">
          Blank (no source): {file.blank_columns.join(", ")}
        </div>
      )}
      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
    </div>
  );
}

export default function PrepareData() {
  const [files, setFiles] = useState<Partial<Record<keyof PrepareFiles, File>>>({});
  const [job, setJob] = useState<PrepareJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!job || (job.state !== "running" && job.state !== "queued")) return;
    const tick = async () => {
      try { setJob(await getPrepareStatus(job.job_id)); }
      catch (e) { setError((e as Error).message); }
    };
    pollRef.current = window.setInterval(tick, 1500);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [job?.state, job?.job_id]);

  const pick = (key: keyof PrepareFiles, f: File | null) => {
    setFiles((prev) => {
      const next = { ...prev };
      if (f) next[key] = f; else delete next[key];
      return next;
    });
  };

  const submit = async () => {
    if (Object.keys(files).length === 0) {
      setError("Upload at least one file to prepare.");
      return;
    }
    setError(null);
    try { setJob(await prepare(files as PrepareFiles)); }
    catch (e) { setError((e as Error).message); }
  };

  const busy = !!job && (job.state === "running" || job.state === "queued");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Prepare Data</h2>
          <p className="text-xs text-slate-500">
            Map raw exports to the template columns and drop Cancelled/closed rows, ready for ComplianceGuard.
          </p>
        </div>
        {job && (
          <button onClick={() => { setJob(null); setError(null); }} className="text-sm text-slate-500 hover:text-slate-700">
            Start over
          </button>
        )}
      </div>

      {!job && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-2">
          {SLOTS.map((slot) => (
            <div key={slot.key} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="w-52 shrink-0">
                <div className="text-sm font-medium text-slate-700">{slot.label}</div>
                <div className="text-[11px] text-slate-400">{slot.filter}</div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsb"
                className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
                onChange={(e) => pick(slot.key, e.target.files?.[0] ?? null)}
              />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button
              disabled={busy}
              onClick={submit}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {busy ? "Preparing…" : "Prepare Files"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {job && (job.state === "running" || job.state === "queued") && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{job.msg || "Working…"}</span>
            <span className="text-sm text-slate-500">{job.pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.max(5, job.pct)}%` }} />
          </div>
        </div>
      )}

      {job && job.state === "error" && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-sm text-rose-700">
          Preparation failed: {job.error ?? "unknown error"}
        </div>
      )}

      {job && job.state === "done" && (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            Done. Download the cleaned files below, then upload them in <strong>ComplianceGuard</strong>.
          </div>
          {job.files.map((f) => (
            <ResultCard key={f.kind} jobId={job.job_id} file={f} />
          ))}
        </div>
      )}
    </div>
  );
}
