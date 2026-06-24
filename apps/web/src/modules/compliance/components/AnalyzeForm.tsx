import { useState } from "react";
import { downloadSample, type SampleKind } from "../api";
import type { AnalyzeFiles } from "../types";

interface Props {
  busy: boolean;
  onSubmit: (files: AnalyzeFiles) => void;
}

interface Slot {
  key: keyof AnalyzeFiles;
  label: string;
  required: boolean;
  sample: SampleKind;
}

const SLOTS: Slot[] = [
  { key: "sales", label: "Sales Data", required: true, sample: "sales" },
  { key: "einvoice", label: "E-Invoice", required: true, sample: "einvoice" },
  { key: "ewaybill", label: "E-way Bill", required: false, sample: "ewaybill" },
  { key: "creditnote", label: "Credit Note", required: false, sample: "creditnote" },
  { key: "cnEinvoice", label: "CN E-Invoice (CDNR)", required: false, sample: "cn-einvoice" },
];

export default function AnalyzeForm({ busy, onSubmit }: Props) {
  const [files, setFiles] = useState<Partial<Record<keyof AnalyzeFiles, File>>>({});
  const [error, setError] = useState<string | null>(null);

  const pick = (key: keyof AnalyzeFiles, f: File | null) => {
    setFiles((prev) => {
      const next = { ...prev };
      if (f) next[key] = f;
      else delete next[key];
      return next;
    });
  };

  const submit = () => {
    if (!files.sales || !files.einvoice) {
      setError("Sales Data and E-Invoice files are required.");
      return;
    }
    setError(null);
    onSubmit({
      sales: files.sales,
      einvoice: files.einvoice,
      ewaybill: files.ewaybill ?? null,
      creditnote: files.creditnote ?? null,
      cnEinvoice: files.cnEinvoice ?? null,
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Upload GST data files</h3>
        <p className="text-xs text-slate-500">
          Sales and E-Invoice are required. E-way Bill, Credit Note and CN E-Invoice are optional —
          add them to enable the related annexure checks.
        </p>
      </div>

      <div className="space-y-2">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <div className="w-44 shrink-0 text-sm font-medium text-slate-700">
              {slot.label}
              {slot.required ? <span className="text-rose-500"> *</span> : (
                <span className="text-slate-400 text-xs"> (optional)</span>
              )}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.xlsb"
              className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
              onChange={(e) => pick(slot.key, e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => downloadSample(slot.sample).catch((e) => setError((e as Error).message))}
              className="ml-auto text-xs text-indigo-600 hover:text-indigo-800"
            >
              sample
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          disabled={busy}
          onClick={submit}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          {busy ? "Analyzing…" : "Run Compliance Check"}
        </button>
      </div>
    </div>
  );
}
