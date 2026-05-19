import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Metric } from "@/components/Metric";
import { CategorizeDrawer } from "@/components/CategorizeDrawer";
import { fetchUncategorized, type BankTransaction } from "@/lib/api";
import { downloadExcel, timestamp } from "@/lib/excel";
import { formatINR, formatNumber } from "@/lib/utils";

interface Props {
  refreshKey: number;
  canCategorize?: boolean;
  onCategorized?: () => void;
}

export function UncategorizedTab({ refreshKey, canCategorize = false, onCategorized }: Props) {
  const [categorizeTarget, setCategorizeTarget] = useState<BankTransaction | null>(null);
  const [rows, setRows] = useState<BankTransaction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [minAmt, setMinAmt] = useState<string>("");
  const [maxAmt, setMaxAmt] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchUncategorized()
      .then((data) => {
        if (!alive) return;
        const credits = data.filter((r) => r.debit_or_credit === "debit");
        setRows(credits);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let out = rows;
    if (from) out = out.filter((r) => (r.date ?? "") >= from);
    if (to) out = out.filter((r) => (r.date ?? "") <= to);
    if (minAmt !== "") out = out.filter((r) => (r.amount ?? 0) >= Number(minAmt));
    if (maxAmt !== "") out = out.filter((r) => (r.amount ?? 0) <= Number(maxAmt));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        [r.payee, r.reference_number, r.description]
          .map((v) => (v ?? "").toString().toLowerCase())
          .some((v) => v.includes(q)),
      );
    }
    return out.slice().sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [rows, from, to, minAmt, maxAmt, search]);

  const total = rows?.length ?? 0;
  const totalAmount = useMemo(
    () => (rows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const onDownload = () => {
    const exportRows = filtered.map((r) => ({
      date: r.date ?? "",
      amount: r.amount ?? 0,
      payee: r.payee ?? "",
      reference_number: r.reference_number ?? "",
      description: r.description ?? "",
      status: r.status ?? "",
      transaction_type: r.transaction_type ?? "",
      transaction_id: r.transaction_id ?? "",
    }));
    downloadExcel(exportRows, `uncategorized_${timestamp()}.xlsx`, "Uncategorized");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Fetching uncategorized transactions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to fetch uncategorized transactions: {error}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        No uncategorized credit transactions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric label="Total credit transactions" value={formatNumber(total)} />
        <Metric label="Total credit amount" value={formatINR(totalAmount)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="text-xs font-medium text-slate-600">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Min amount</label>
          <Input
            type="number"
            value={minAmt}
            onChange={(e) => setMinAmt(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Max amount</label>
          <Input
            type="number"
            value={maxAmt}
            onChange={(e) => setMaxAmt(e.target.value)}
            placeholder="∞"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Search</label>
          <Input
            placeholder="payee / ref / description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold">{filtered.length}</span> of{" "}
          <span className="font-semibold">{total}</span> transactions
        </div>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Amount (₹)</th>
              <th className="px-3 py-2">Payee</th>
              <th className="px-3 py-2">Reference#</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
              {canCategorize && <th className="px-3 py-2 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={String(r.transaction_id)} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-3 py-2">{r.date ?? ""}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatINR(Number(r.amount) || 0)}
                </td>
                <td className="px-3 py-2">{r.payee ?? ""}</td>
                <td className="px-3 py-2">{r.reference_number ?? ""}</td>
                <td className="px-3 py-2">{r.description ?? ""}</td>
                <td className="px-3 py-2">{r.status ?? ""}</td>
                {canCategorize && (
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={() => setCategorizeTarget(r)}>
                      Categorize
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CategorizeDrawer
        open={categorizeTarget !== null}
        bankTxn={categorizeTarget}
        onClose={() => setCategorizeTarget(null)}
        onMatched={() => {
          setCategorizeTarget(null);
          onCategorized?.();
        }}
      />
    </div>
  );
}
