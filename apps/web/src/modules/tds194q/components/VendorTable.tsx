import { useState } from "react";
import { downloadFile } from "../api";
import type { Job, VendorRow, VendorStatus } from "../types";
import PreviewModal from "./PreviewModal";

const STATUS_STYLE: Record<VendorStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  sending: "bg-indigo-100 text-indigo-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-slate-100 text-slate-500",
};

interface Props {
  job: Job;
}

export default function VendorTable({ job }: Props) {
  const { vendors, job_id } = job;
  const withEmail = vendors.filter((v) => v.has_email).length;
  const [previewVendor, setPreviewVendor] = useState<VendorRow | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      await downloadFile(job_id, filename);
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Vendor preview</h2>
          <p className="text-sm text-slate-500">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} bifurcated ·{" "}
            {withEmail} with emails on file
          </p>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-slate-600">
              <th className="px-6 py-3 font-medium">#</th>
              <th className="px-6 py-3 font-medium">Vendor</th>
              <th className="px-6 py-3 font-medium">Intended email</th>
              <th className="px-6 py-3 font-medium">File</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.map((v, i) => (
              <tr key={v.name} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-slate-400">{i + 1}</td>
                <td className="px-6 py-3 text-slate-800">{v.name}</td>
                <td className="px-6 py-3">
                  {v.has_email ? (
                    <span className="text-slate-700">{v.intended_email}</span>
                  ) : (
                    <span className="text-amber-700 italic">no email on file</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(v.file)}
                    disabled={downloading === v.file}
                    className="text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {downloading === v.file ? "…" : v.file}
                  </button>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[v.status] ?? STATUS_STYLE.pending}`}
                  >
                    {v.status}
                  </span>
                  {v.error && (
                    <div className="text-xs text-rose-600 mt-1">{v.error}</div>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => setPreviewVendor(v)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-slate-700 transition"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewVendor && (
        <PreviewModal
          jobId={job_id}
          vendor={previewVendor}
          onClose={() => setPreviewVendor(null)}
          onDownload={() => handleDownload(previewVendor.file)}
        />
      )}
    </div>
  );
}
