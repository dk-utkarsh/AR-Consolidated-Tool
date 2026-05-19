import { useRef, useState } from "react";
import { uploadFile } from "../api";
import type { Job } from "../types";

interface Props {
  onUploaded: (job: Job) => void;
}

export default function UploadStep({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) setFile(f);
  };

  const onSubmit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const job = await uploadFile(file);
      onUploaded(job);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Step 1 — Upload 194Q.xlsx</h2>
      <p className="text-sm text-slate-500 mb-6">
        We'll read <code className="px-1 py-0.5 bg-slate-100 rounded">Sheet3</code>, split each
        vendor block into its own xlsx, and look up vendor emails from Zoho Books.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onPick}
        />
        {file ? (
          <div>
            <div className="text-slate-800 font-medium">{file.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              {(file.size / 1024).toFixed(1)} KB · click to change
            </div>
          </div>
        ) : (
          <div>
            <div className="text-slate-700">Drop your <strong>194Q.xlsx</strong> here</div>
            <div className="text-xs text-slate-500 mt-1">or click to browse</div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          disabled={!file || busy}
          onClick={onSubmit}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          {busy ? "Bifurcating & looking up emails…" : "Upload & Bifurcate"}
        </button>
      </div>
    </div>
  );
}
