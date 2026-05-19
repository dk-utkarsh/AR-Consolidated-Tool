import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Metric } from "@/components/Metric";
import { fetchLedger, type LedgerTransaction } from "@/lib/api";
import { downloadExcel, timestamp } from "@/lib/excel";
import {
  firstOfMonthISO,
  formatDateDMY,
  formatINR,
  formatNumber,
  todayISO,
} from "@/lib/utils";

interface Props {
  account: "suspense" | "misc-debtor";
  title: string;
  organizationName: string;
  fileSlug: string;
  refreshKey: number;
  hideDetails?: boolean;
}

const WIDE_FROM = firstOfMonthISO();

export function LedgerTab({
  account,
  title,
  organizationName,
  fileSlug,
  refreshKey,
  hideDetails = false,
}: Props) {
  const [allRows, setAllRows] = useState<LedgerTransaction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  const [search, setSearch] = useState("");
  const [showDebit, setShowDebit] = useState(true);
  const [showCredit, setShowCredit] = useState(true);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchLedger(account, WIDE_FROM, todayISO())
      .then((data) => alive && setAllRows(data))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [account, refreshKey]);

  const periodRows = useMemo(() => {
    if (!allRows) return [];
    return allRows.filter((r) => {
      const d = r.transaction_date ?? "";
      return d >= from && d <= to;
    });
  }, [allRows, from, to]);

  const opening = useMemo(() => {
    if (!allRows) return 0;
    return allRows
      .filter((r) => (r.transaction_date ?? "") < from)
      .reduce(
        (s, r) => s + (Number(r.debit_amount) || 0) - (Number(r.credit_amount) || 0),
        0,
      );
  }, [allRows, from]);

  const periodDebit = useMemo(
    () => periodRows.reduce((s, r) => s + (Number(r.debit_amount) || 0), 0),
    [periodRows],
  );
  const periodCredit = useMemo(
    () => periodRows.reduce((s, r) => s + (Number(r.credit_amount) || 0), 0),
    [periodRows],
  );
  const closing = opening + periodDebit - periodCredit;

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of periodRows) {
      if (r.transaction_type_formatted) set.add(r.transaction_type_formatted);
    }
    return Array.from(set).sort();
  }, [periodRows]);

  const filtered = useMemo(() => {
    let out = periodRows;
    out = out.filter((r) => {
      if (r.debit_or_credit === "debit") return showDebit;
      if (r.debit_or_credit === "credit") return showCredit;
      return true;
    });
    if (types.length > 0) {
      out = out.filter(
        (r) =>
          r.transaction_type_formatted &&
          types.includes(r.transaction_type_formatted),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        [
          r.offset_account_name,
          r.payee,
          r.description,
          r.reference_number,
          r.entry_number,
        ]
          .map((v) => (v ?? "").toString().toLowerCase())
          .some((v) => v.includes(q)),
      );
    }
    return out
      .slice()
      .sort((a, b) =>
        (a.transaction_date ?? "").localeCompare(b.transaction_date ?? ""),
      );
  }, [periodRows, showDebit, showCredit, types, search]);

  const toggleType = (t: string) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const buildExportRows = () => {
    const rows: Array<Record<string, string | number>> = [];
    rows.push({
      DATE: `As On ${formatDateDMY(from)}`,
      ACCOUNT: "Opening Balance",
      "TRANSACTION DETAILS": "",
      "TRANSACTION TYPE": "",
      "TRANSACTION#": "",
      "REFERENCE#": "",
      DEBIT: opening >= 0 ? opening : 0,
      CREDIT: opening < 0 ? -opening : 0,
      "NET AMOUNT": opening,
      DESCRIPTION: "",
    });
    for (const r of filtered) {
      const debit = Number(r.debit_amount) || 0;
      const credit = Number(r.credit_amount) || 0;
      rows.push({
        DATE: formatDateDMY(r.transaction_date),
        ACCOUNT: r.offset_account_name ?? "",
        "TRANSACTION DETAILS": r.payee || r.description || "",
        "TRANSACTION TYPE": r.transaction_type_formatted ?? "",
        "TRANSACTION#": r.entry_number ?? "",
        "REFERENCE#": r.reference_number ?? "",
        DEBIT: debit,
        CREDIT: credit,
        "NET AMOUNT": debit - credit,
        DESCRIPTION: r.description ?? "",
      });
    }
    rows.push({
      DATE: `As On ${formatDateDMY(to)}`,
      ACCOUNT: "Closing Balance",
      "TRANSACTION DETAILS": "",
      "TRANSACTION TYPE": "",
      "TRANSACTION#": "",
      "REFERENCE#": "",
      DEBIT: closing >= 0 ? closing : 0,
      CREDIT: closing < 0 ? -closing : 0,
      "NET AMOUNT": closing,
      DESCRIPTION: "",
    });
    return rows;
  };

  const onDownload = () => {
    downloadExcel(buildExportRows(), `${fileSlug}_${timestamp()}.xlsx`, title);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Fetching {title} ledger…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to fetch {title} transactions: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">From date</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">To date</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-center">
        <div className="text-sm font-semibold">{organizationName}</div>
        <div className="text-xs text-slate-500">Basis : Accrual</div>
        <div className="mt-1 text-xl font-bold">{title}</div>
        <div className="text-xs text-slate-500">
          From {formatDateDMY(from)} To {formatDateDMY(to)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Transactions" value={formatNumber(periodRows.length)} />
        <Metric label="Opening balance" value={formatINR(opening)} />
        <Metric label="Period debit" value={formatINR(periodDebit)} />
        <Metric label="Period credit" value={formatINR(periodCredit)} />
        <Metric label="Closing balance" value={formatINR(closing)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Search</label>
          <Input
            placeholder="account / details / reference / description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Debit / Credit</label>
          <div className="flex h-9 items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showDebit}
                onChange={(e) => setShowDebit(e.target.checked)}
              />
              Debit
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showCredit}
                onChange={(e) => setShowCredit(e.target.checked)}
              />
              Credit
            </label>
          </div>
        </div>
      </div>

      {typeOptions.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600">Transaction type</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {typeOptions.map((t) => {
              const active = types.length === 0 || types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-500"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold">{filtered.length}</span> of{" "}
          <span className="font-semibold">{periodRows.length}</span> transactions in selected range
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
              <th className="px-3 py-2">Account</th>
              {!hideDetails && <th className="px-3 py-2">Details</th>}
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Txn#</th>
              <th className="px-3 py-2">Ref#</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100 bg-slate-50 font-semibold">
              <td className="px-3 py-2">As On {formatDateDMY(from)}</td>
              <td className="px-3 py-2" colSpan={hideDetails ? 5 : 6}>
                Opening Balance
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {opening >= 0 ? formatINR(opening) : ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {opening < 0 ? formatINR(-opening) : ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(opening)}</td>
            </tr>
            {filtered.map((r, idx) => {
              const debit = Number(r.debit_amount) || 0;
              const credit = Number(r.credit_amount) || 0;
              return (
                <tr key={`${r.entry_number ?? idx}-${idx}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDateDMY(r.transaction_date)}
                  </td>
                  <td className="px-3 py-2">{r.offset_account_name ?? ""}</td>
                  {!hideDetails && (
                    <td className="px-3 py-2">
                      {r.payee || r.description || ""}
                    </td>
                  )}
                  <td className="px-3 py-2">{r.transaction_type_formatted ?? ""}</td>
                  <td className="px-3 py-2">{r.entry_number ?? ""}</td>
                  <td className="px-3 py-2">{r.reference_number ?? ""}</td>
                  <td className="px-3 py-2">{r.description ?? ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {debit ? formatINR(debit) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {credit ? formatINR(credit) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatINR(debit - credit)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-slate-100 bg-slate-50 font-semibold">
              <td className="px-3 py-2">As On {formatDateDMY(to)}</td>
              <td className="px-3 py-2" colSpan={hideDetails ? 5 : 6}>
                Closing Balance
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {closing >= 0 ? formatINR(closing) : ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {closing < 0 ? formatINR(-closing) : ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
