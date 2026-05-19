import { useEffect, useState } from "react";
import { getPreview } from "../api";
import type { Preview, VendorRow } from "../types";

interface Props {
  jobId: string;
  vendor: VendorRow;
  onClose: () => void;
  onDownload: () => void;
}

export default function PreviewModal({ jobId, vendor, onClose, onDownload }: Props) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPreview(jobId, vendor.file)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e: Error) => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [jobId, vendor.file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">{vendor.name}</h3>
            <p className="text-xs text-slate-500 truncate">{vendor.file}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Download xlsx
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading && <div className="text-slate-500 text-sm">Loading preview…</div>}

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-900 text-white px-4 py-3">
                <div className="font-semibold">{data.title}</div>
                <div className="text-xs text-slate-300 mt-0.5">{data.subtitle}</div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-indigo-700 text-white">
                    <tr>
                      {data.header.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {h === null ? "" : String(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {cell === null || cell === undefined ? "" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {data.total && data.total.length > 0 && (
                      <tr className="bg-indigo-50 font-semibold text-slate-800">
                        {data.total.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 whitespace-nowrap">
                            {cell === null || cell === undefined ? "" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-500">
                {data.rows.length} entr{data.rows.length === 1 ? "y" : "ies"} in this statement.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
