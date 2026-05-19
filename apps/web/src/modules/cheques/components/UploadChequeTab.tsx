import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ImageIcon, Plus, Sparkles, Trash2, X } from "lucide-react";
import { clearSession, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { money } from "../format";

const WORKER_BASE = (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/$/, "");

interface MatchRow {
  payment_id: string;
  payment_number: string | null;
  date: string | null;
  customer: string | null;
  amount: number | null;
  reference_number: string | null;
  unused_amount: number | null;
  status: string;
  invoice: string;
  rejected_reason?: string;
}

interface OcrResult {
  image: string;
  fields: {
    cheque_number: string | null;
    vendor_name: string | null;
    amount: number | null;
    amount_in_words: string | null;
    date: string | null;
  };
  warnings: string[];
  matches: MatchRow[];
  rejected: MatchRow[];
  total_candidates: number;
  error?: string;
}

interface CreateResult {
  ok: boolean;
  payment_id?: string;
  payment_number?: string;
  customer_name?: string;
  message?: string;
  code?: string;
  error?: string;
}

interface CardState {
  key: string;
  file: File;
  previewUrl: string;
  result: OcrResult | null;
  loading: boolean;
  error: string | null;
  // Editable copies, initialised from result.fields then user-editable.
  editCheque: string;
  editDate: string;
  editAmount: string;
  editVendor: string;
  lookupBusy: boolean;
  lookupDone: boolean;          // true once the user has clicked "Lookup in Zoho Books" at least once for this card
  createBusy: boolean;
  createResult: CreateResult | null;
  expanded: boolean;
}

function makeKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${b}B`;
}

function shortName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf(".");
  if (ext < 0) return name.slice(0, max - 1) + "…";
  const head = name.slice(0, Math.max(3, max - (name.length - ext) - 1));
  return `${head}…${name.slice(ext)}`;
}

export default function UploadChequeTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [cards, setCards] = useState<CardState[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Always points at the latest cards array — used by async handlers so they
  // never read a stale closure when the user edited a field immediately
  // before clicking a button.
  const cardsRef = useRef<CardState[]>([]);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Revoke object URLs on unmount / file change.
  useEffect(() => {
    return () => {
      cards.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    setFiles((cur) => {
      const seen = new Set(cur.map(makeKey));
      const newOnes = list.filter((f) => !seen.has(makeKey(f)));
      return [...cur, ...newOnes];
    });
  };

  const removeFile = (key: string) => {
    setFiles((cur) => cur.filter((f) => makeKey(f) !== key));
    setCards((cur) => {
      const stay = cur.filter((c) => c.key !== key);
      cur
        .filter((c) => c.key === key)
        .forEach((c) => URL.revokeObjectURL(c.previewUrl));
      return stay;
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";   // allow re-picking same file
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const onClear = () => {
    cards.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    setFiles([]);
    setCards([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onExtract = async () => {
    if (files.length === 0) return;
    setExtracting(true);

    // Seed loading cards for every file (clear old ones for files no longer present).
    const seeds: CardState[] = files.map((f) => {
      const key = makeKey(f);
      const existing = cards.find((c) => c.key === key);
      // reuse existing previewUrl if we already created one
      const previewUrl = existing?.previewUrl ?? URL.createObjectURL(f);
      return {
        key,
        file: f,
        previewUrl,
        result: null,
        loading: true,
        error: null,
        editCheque: "",
        editDate: "",
        editAmount: "",
        editVendor: "",
        lookupBusy: false,
        lookupDone: false,
        createBusy: false,
        createResult: null,
        expanded: true,
      };
    });
    // Revoke URLs for cards that were removed.
    cards.filter((c) => !seeds.find((s) => s.key === c.key)).forEach((c) => URL.revokeObjectURL(c.previewUrl));
    setCards(seeds);

    // Fire all OCR calls in parallel; update each card as it finishes.
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    await Promise.all(
      seeds.map(async (seed) => {
        const fd = new FormData();
        fd.append("image", seed.file);
        try {
          const res = await fetch(`${WORKER_BASE}/cheques/ocr`, { method: "POST", headers, body: fd });
          if (res.status === 401) {
            clearSession();
            window.location.reload();
            return;
          }
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (!res.ok) {
            setCards((cur) =>
              cur.map((c) => (c.key === seed.key ? { ...c, loading: false, error: (data as { error?: string })?.error ?? `HTTP ${res.status}` } : c)),
            );
            return;
          }
          const r = data as OcrResult;
          setCards((cur) =>
            cur.map((c) =>
              c.key === seed.key
                ? {
                    ...c,
                    loading: false,
                    result: r,
                    editCheque: r.fields.cheque_number ?? "",
                    editDate: r.fields.date ?? "",
                    editAmount: r.fields.amount === null ? "" : String(r.fields.amount),
                    editVendor: r.fields.vendor_name ?? "",
                  }
                : c,
            ),
          );
        } catch (e) {
          setCards((cur) =>
            cur.map((c) => (c.key === seed.key ? { ...c, loading: false, error: (e as Error).message } : c)),
          );
        }
      }),
    );

    setExtracting(false);
  };

  const onLookup = async (key: string) => {
    const card = cardsRef.current.find((c) => c.key === key);
    if (!card || !card.editCheque.trim()) return;
    setCards((cur) => cur.map((c) => (c.key === key ? { ...c, lookupBusy: true, error: null } : c)));
    try {
      const token = getToken();
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_BASE}/cheques/lookup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cheque_number: card.editCheque.trim(),
          cheque_date: card.editDate.trim() || null,
          amount: card.editAmount.trim() === "" ? null : Number(card.editAmount.replace(/[,₹\s]/g, "")),
          vendor_name: card.editVendor.trim() || null,
        }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.reload();
        return;
      }
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setCards((cur) =>
          cur.map((c) => (c.key === key ? { ...c, lookupBusy: false, error: (data as { error?: string })?.error ?? `HTTP ${res.status}` } : c)),
        );
        return;
      }
      const r = data as {
        fields: { cheque_number: string; cheque_date: string | null; amount: number | null; vendor_name: string | null };
        matches: MatchRow[];
        rejected: MatchRow[];
        total_candidates: number;
      };
      setCards((cur) =>
        cur.map((c) =>
          c.key === key && c.result
            ? {
                ...c,
                lookupBusy: false,
                lookupDone: true,
                result: {
                  ...c.result,
                  fields: {
                    cheque_number: r.fields.cheque_number,
                    vendor_name: r.fields.vendor_name,
                    amount: r.fields.amount,
                    amount_in_words: null,
                    date: r.fields.cheque_date,
                  },
                  matches: r.matches,
                  rejected: r.rejected,
                  total_candidates: r.total_candidates,
                  warnings: [],
                },
              }
            : c,
        ),
      );
    } catch (e) {
      setCards((cur) =>
        cur.map((c) => (c.key === key ? { ...c, lookupBusy: false, error: (e as Error).message } : c)),
      );
    }
  };

  const updateCard = (key: string, patch: Partial<CardState>) => {
    setCards((cur) => cur.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const onCreatePayment = async (key: string) => {
    const card = cardsRef.current.find((c) => c.key === key);
    if (!card) return;
    if (!card.editCheque.trim() || !card.editDate.trim() || !card.editVendor.trim() || !card.editAmount.trim()) {
      updateCard(key, { createResult: { ok: false, error: "All four fields (cheque #, date, amount, vendor) are required." } });
      return;
    }
    const confirmed = window.confirm(
      `Create a new customer payment in Zoho Books?\n\n` +
      `Vendor: ${card.editVendor.trim()}\n` +
      `Cheque: ${card.editCheque.trim()}\n` +
      `Date: ${card.editDate.trim()}\n` +
      `Amount: ₹${card.editAmount.trim()}\n\n` +
      `It will be deposited to the "Cheque In hand" account, unapplied.`,
    );
    if (!confirmed) return;
    updateCard(key, { createBusy: true, createResult: null });
    try {
      const token = getToken();
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${WORKER_BASE}/cheques/create-payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cheque_number: card.editCheque.trim(),
          cheque_date: card.editDate.trim(),
          amount: Number(card.editAmount.replace(/[,₹\s]/g, "")),
          vendor_name: card.editVendor.trim(),
        }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.reload();
        return;
      }
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as CreateResult;
      updateCard(key, { createBusy: false, createResult: data });
    } catch (e) {
      updateCard(key, { createBusy: false, createResult: { ok: false, error: (e as Error).message } });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          📤 Upload cheque image(s)
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Pick one or more cheque photos (camera or gallery). After extraction you can edit any field before exporting.
        </p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-3"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
        />
        <div className="flex flex-wrap items-center gap-2">
          {files.map((f) => {
            const key = makeKey(f);
            return (
              <div
                key={key}
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-2 py-1.5 text-xs shadow-sm"
              >
                <div className="h-8 w-8 rounded bg-slate-800 text-white flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-800 font-medium truncate max-w-[160px]">{shortName(f.name)}</span>
                  <span className="text-[10px] text-slate-500">{fmtBytes(f.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(key)}
                  className="ml-1 text-slate-400 hover:text-rose-600 rounded-full"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center h-11 w-11 rounded-lg bg-white border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
            aria-label="Add files"
          >
            <Plus className="h-5 w-5" />
          </button>
          {files.length === 0 && (
            <span className="text-xs text-slate-500 ml-1">Drop image(s) here or click +</span>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={onExtract}
          disabled={files.length === 0 || extracting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white font-semibold py-3 transition shadow-sm"
        >
          <Sparkles className="h-4 w-4" />
          {extracting ? `Extracting from ${files.length} file(s)…` : `Extract from ${files.length} file(s)`}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={files.length === 0 && cards.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 px-6 py-3 font-medium transition"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
      </div>

      {cards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            📝 Review &amp; edit ({cards.length})
          </h3>
          {cards.map((c) => (
            <ReviewCard
              key={c.key}
              card={c}
              onToggle={() => updateCard(c.key, { expanded: !c.expanded })}
              onChangeCheque={(v) => updateCard(c.key, { editCheque: v })}
              onChangeDate={(v) => updateCard(c.key, { editDate: v })}
              onChangeAmount={(v) => updateCard(c.key, { editAmount: v })}
              onChangeVendor={(v) => updateCard(c.key, { editVendor: v })}
              onLookup={() => onLookup(c.key)}
              onCreatePayment={() => onCreatePayment(c.key)}
              onRemove={() => removeFile(c.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  card: CardState;
  onToggle: () => void;
  onChangeCheque: (v: string) => void;
  onChangeDate: (v: string) => void;
  onChangeAmount: (v: string) => void;
  onChangeVendor: (v: string) => void;
  onLookup: () => void;
  onCreatePayment: () => void;
  onRemove: () => void;
}

function ReviewCard({ card, onToggle, onChangeCheque, onChangeDate, onChangeAmount, onChangeVendor, onLookup, onCreatePayment, onRemove }: ReviewCardProps) {
  const { file, previewUrl, result, loading, error, editCheque, editDate, editAmount, editVendor, lookupBusy, lookupDone, createBusy, createResult, expanded } = card;
  const canCreate = !!editCheque.trim() && !!editDate.trim() && !!editVendor.trim() && !!editAmount.trim();

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
        <span className="text-sm font-medium text-slate-800 flex-1 truncate">{file.name}</span>
        {loading && <span className="text-xs text-slate-500 animate-pulse">Extracting…</span>}
        {error && <span className="text-xs text-rose-600">Error</span>}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-slate-400 hover:text-rose-600 p-1"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-3">
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center min-h-[180px] overflow-hidden">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img src={previewUrl} alt="cheque preview" className="max-h-72 object-contain" />
            </div>
            <div className="space-y-3">
              <EditField label="Cheque No." value={editCheque} onChange={onChangeCheque} placeholder="6 digits" />
              <EditField label="Cheque Date" value={editDate} onChange={onChangeDate} type="date" />
              <EditField label="Amount (₹)" value={editAmount} onChange={onChangeAmount} type="number" placeholder="0" />
              <EditField label="Vendor (drawer)" value={editVendor} onChange={onChangeVendor} placeholder="e.g. AXIOM DENTAL" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={onLookup} disabled={lookupBusy || loading || !editCheque.trim()} size="sm" variant="outline">
                  {lookupBusy ? "Looking up…" : lookupDone ? "Re-lookup in Zoho Books" : "Lookup in Zoho Books"}
                </Button>
                <Button
                  onClick={onCreatePayment}
                  disabled={createBusy || loading || !canCreate || createResult?.ok === true}
                  size="sm"
                >
                  {createBusy
                    ? "Creating payment…"
                    : createResult?.ok
                    ? "Payment created ✓"
                    : "Create payment in Zoho"}
                </Button>
              </div>
            </div>
          </div>

          {createResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                createResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {createResult.ok ? (
                <>
                  <div className="font-medium">{createResult.message}</div>
                  {createResult.payment_number && (
                    <div className="text-xs mt-0.5">
                      Payment #: <strong>{createResult.payment_number}</strong> · Customer: <strong>{createResult.customer_name}</strong>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-medium">Payment not created</div>
                  <div className="text-xs mt-0.5">{createResult.error}</div>
                  {createResult.code === "no_customer_match" && (
                    <div className="text-xs mt-1 text-slate-600">
                      Tip: edit the Vendor field to match the exact Zoho customer name and try again.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {result && lookupDone && (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-600 uppercase tracking-wider">
                Zoho matches ({result.matches.length} of {result.total_candidates})
              </div>
              {result.matches.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">
                  {result.total_candidates === 0
                    ? "No customer payments in Zoho with this cheque number."
                    : `${result.total_candidates} payment(s) shared the reference but failed date + amount + vendor cross-check.`}
                </div>
              ) : (
                <MatchTable rows={result.matches} />
              )}
              {result.rejected.length > 0 && (
                <div className="border-t border-slate-100">
                  <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Rejected candidates ({result.rejected.length})
                  </div>
                  <MatchTable rows={result.rejected} showReason />
                </div>
              )}
            </div>
          )}

          {result?.warnings && result.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <ul className="list-disc list-inside space-y-0.5">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "number";
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-600 block mb-1">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
      />
    </div>
  );
}

function MatchTable({ rows, showReason }: { rows: MatchRow[]; showReason?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-600">
            <th className="px-3 py-2 font-medium">Payment #</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium text-right">Amount</th>
            <th className="px-3 py-2 font-medium">Reference</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Invoice</th>
            {showReason && <th className="px-3 py-2 font-medium">Why rejected</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.payment_id} className="hover:bg-slate-50">
              <td className="px-3 py-2">{r.payment_number ?? "—"}</td>
              <td className="px-3 py-2">{r.date ?? "—"}</td>
              <td className="px-3 py-2">{r.customer ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.amount === null ? "—" : money(r.amount)}</td>
              <td className="px-3 py-2">{r.reference_number ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{r.status}</td>
              <td className="px-3 py-2 text-slate-600">{r.invoice}</td>
              {showReason && <td className="px-3 py-2 text-rose-700">{r.rejected_reason ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
