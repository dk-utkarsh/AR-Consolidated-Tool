import { Fragment, useMemo, useState } from "react";
import { money } from "../format";
import type { CustomerSummary, DashboardData, OpenDebit } from "../types";

interface Props {
  data: DashboardData;
}

type Horizon = "All" | "≤ 2 days" | "≤ 6 days" | "≤ 15 days" | "Overdue";

const HORIZON_COL: Record<Exclude<Horizon, "All">, keyof CustomerSummary> = {
  "≤ 2 days": "due_in_2d",
  "≤ 6 days": "due_in_6d",
  "≤ 15 days": "due_in_15d",
  Overdue: "overdue",
};

const HORIZON_LABEL: Record<Exclude<Horizon, "All">, string> = {
  "≤ 2 days": "≤2d",
  "≤ 6 days": "≤6d",
  "≤ 15 days": "≤15d",
  Overdue: "Overdue",
};

function filterByHorizon(open: OpenDebit[], h: Horizon): OpenDebit[] {
  if (h === "All") return open;
  if (h === "Overdue") return open.filter((r) => (r.days_to_clear ?? Infinity) < 0);
  const limit = h === "≤ 2 days" ? 2 : h === "≤ 6 days" ? 6 : 15;
  return open.filter((r) => (r.days_to_clear ?? -1) >= 0 && (r.days_to_clear ?? -1) <= limit);
}

function chequesForVendor(openDebits: OpenDebit[], vendor: string, horizon: Horizon): OpenDebit[] {
  const grp = openDebits.filter((d) => d.vendor === vendor);
  return filterByHorizon(grp, horizon);
}

export default function CustomersTab({ data }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("All");
  const [search, setSearch] = useState("");
  const [showCheques, setShowCheques] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleVendor = (customer: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  };

  // Customer summary rows (used when showCheques = false).
  const rows = useMemo(() => {
    let summary = data.summary.filter(
      (s) => !search || s.customer.toLowerCase().includes(search.toLowerCase()),
    );
    if (horizon !== "All") {
      const col = HORIZON_COL[horizon];
      summary = summary
        .filter((s) => (s[col] as number) > 0.005)
        .sort((a, b) => (b[col] as number) - (a[col] as number));
    }
    return summary;
  }, [data.summary, search, horizon]);

  // Flat open-cheque rows (used when showCheques = true).
  const chequeRows = useMemo(() => {
    let cheques = filterByHorizon(data.open_debits, horizon);
    if (search) {
      const q = search.toLowerCase();
      cheques = cheques.filter((c) => c.vendor.toLowerCase().includes(q));
    }
    // Sort by days_to_clear ascending: overdue first, then nearest due.
    return cheques.slice().sort((a, b) => {
      const ad = a.days_to_clear ?? Infinity;
      const bd = b.days_to_clear ?? Infinity;
      return ad - bd;
    });
  }, [data.open_debits, search, horizon]);

  const openCountForRow = (customer: string): number => {
    if (horizon === "All") {
      return data.summary.find((s) => s.customer === customer)?.open_cheques ?? 0;
    }
    return chequesForVendor(data.open_debits, customer, horizon).length;
  };

  const chequeRefsForRow = (customer: string): string => {
    const cheques = chequesForVendor(data.open_debits, customer, horizon);
    const refs = cheques.map((c) => c.reference_number.trim()).filter(Boolean);
    return refs.length ? refs.join(", ") : "—";
  };

  const showAllAging = horizon === "All";
  const activeAging = horizon === "All" ? null : HORIZON_COL[horizon];
  const activeLabel = horizon === "All" ? null : HORIZON_LABEL[horizon];

  const downloadCsv = () => {
    if (showCheques) {
      const header = ["Date", "Customer", "Reference", "Type", "Cheque Amount", "Cleared", "Outstanding", "Days to Clear", "Status"];
      const csv = [
        header.join(","),
        ...chequeRows.map((c) =>
          [
            c.date,
            `"${c.vendor.replace(/"/g, '""')}"`,
            `"${(c.reference_number || "").replace(/"/g, '""')}"`,
            `"${(c.transaction_type || "").replace(/"/g, '""')}"`,
            c.debit_amt,
            c.paid_amount,
            c.outstanding,
            c.days_to_clear ?? "",
            c.status,
          ].join(","),
        ),
      ].join("\n");
      downloadFile(csv, "cheque_open_list.csv");
      return;
    }

    const baseCols: Array<{ key: keyof CustomerSummary; label: string }> = [
      { key: "customer", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "total_issued", label: "Total Issued" },
      { key: "total_cleared", label: "Total Cleared" },
      { key: "balance_outstanding", label: "Balance (Outstanding)" },
    ];
    const agingCols: Array<{ key: keyof CustomerSummary; label: string }> = showAllAging
      ? [
          { key: "overdue", label: "Overdue" },
          { key: "due_in_2d", label: "Due in ≤2d" },
          { key: "due_in_6d", label: "Due in ≤6d" },
          { key: "due_in_15d", label: "Due in ≤15d" },
        ]
      : [{ key: activeAging as keyof CustomerSummary, label: `Due ${activeLabel}` }];

    const allCols = [...baseCols, ...agingCols];
    const csv = [
      [...allCols.map((c) => c.label), "# Open Cheques", "Cheque #s"].join(","),
      ...rows.map((r) =>
        [
          ...allCols.map((c) => {
            const v = r[c.key];
            if (typeof v === "string") return `"${v.replace(/"/g, '""')}"`;
            return String(v);
          }),
          String(openCountForRow(r.customer)),
          `"${chequeRefsForRow(r.customer).replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");
    downloadFile(csv, "cheque_customer_summary.csv");
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Customer name contains…"
          className="text-sm px-3 py-2 border border-slate-200 rounded-lg flex-1 min-w-[200px]"
        />
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
          {(["All", "≤ 2 days", "≤ 6 days", "≤ 15 days", "Overdue"] as Horizon[]).map((h) => (
            <label key={h} className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="radio"
                name="cheque-horizon"
                value={h}
                checked={horizon === h}
                onChange={() => setHorizon(h)}
                className="accent-indigo-600"
              />
              {h}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer select-none border-l border-slate-200 pl-3 ml-1">
          <input
            type="checkbox"
            checked={showCheques}
            onChange={(e) => setShowCheques(e.target.checked)}
            className="accent-indigo-600"
          />
          Show open cheques
        </label>
        <button
          onClick={downloadCsv}
          className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          ⬇️ CSV
        </button>
      </div>

      {showCheques ? (
        <ChequeListTable rows={chequeRows} horizon={horizon} />
      ) : (
        <CustomerSummaryTable
          rows={rows}
          horizon={horizon}
          showAllAging={showAllAging}
          activeAging={activeAging}
          activeLabel={activeLabel}
          openCountForRow={openCountForRow}
          chequeRefsForRow={chequeRefsForRow}
          openDebits={data.open_debits}
          expanded={expanded}
          onToggle={toggleVendor}
        />
      )}
    </div>
  );
}

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

interface SummaryTableProps {
  rows: CustomerSummary[];
  horizon: Horizon;
  showAllAging: boolean;
  activeAging: keyof CustomerSummary | null;
  activeLabel: string | null;
  openCountForRow: (customer: string) => number;
  chequeRefsForRow: (customer: string) => string;
  openDebits: OpenDebit[];
  expanded: Set<string>;
  onToggle: (customer: string) => void;
}

function CustomerSummaryTable(p: SummaryTableProps) {
  const { rows, horizon, showAllAging, activeAging, activeLabel, openCountForRow, chequeRefsForRow, openDebits, expanded, onToggle } = p;
  const totalCols = showAllAging ? 12 : 9;          // +1 for the checkbox column
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 text-sm font-medium text-slate-700">
        {horizon === "All"
          ? `All customers (${rows.length})`
          : `Customers with cheques due ${horizon} (${rows.length})`}
      </div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2 font-medium w-8"></th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Total Issued</th>
              <th className="px-4 py-2 font-medium text-right">Cleared</th>
              <th className="px-4 py-2 font-medium text-right">Outstanding</th>
              {showAllAging ? (
                <>
                  <th className="px-4 py-2 font-medium text-right">Overdue</th>
                  <th className="px-4 py-2 font-medium text-right">≤2d</th>
                  <th className="px-4 py-2 font-medium text-right">≤6d</th>
                  <th className="px-4 py-2 font-medium text-right">≤15d</th>
                </>
              ) : (
                <th className="px-4 py-2 font-medium text-right bg-indigo-50 text-indigo-700">Due {activeLabel}</th>
              )}
              <th className="px-4 py-2 font-medium text-right"># Open</th>
              <th className="px-4 py-2 font-medium">Cheque #s</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const isOpen = expanded.has(r.customer);
              const cheques = chequesForVendor(openDebits, r.customer, horizon);
              return (
                <Fragment key={r.customer}>
                  <tr className={isOpen ? "bg-indigo-50/60" : "hover:bg-slate-50"}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => onToggle(r.customer)}
                        className="accent-indigo-600 cursor-pointer"
                        aria-label={`Show cheques for ${r.customer}`}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-800">{r.customer}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(r.total_issued)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{money(r.total_cleared)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-700 font-medium">
                      {money(r.balance_outstanding)}
                    </td>
                    {showAllAging ? (
                      <>
                        <td className="px-4 py-2 text-right tabular-nums text-orange-700">{money(r.overdue)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(r.due_in_2d)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(r.due_in_6d)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(r.due_in_15d)}</td>
                      </>
                    ) : (
                      <td className="px-4 py-2 text-right tabular-nums bg-indigo-50 text-indigo-800 font-medium">
                        {money(r[activeAging as keyof CustomerSummary] as number)}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right tabular-nums">{openCountForRow(r.customer)}</td>
                    <td className="px-4 py-2 text-slate-600 truncate max-w-[260px]">{chequeRefsForRow(r.customer)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={totalCols} className="px-4 py-3">
                        <VendorChequesPanel cheques={cheques} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-sm text-slate-500">
                  {horizon === "All"
                    ? "No customers match the current filters."
                    : `No customers have cheques due ${horizon}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorChequesPanel({ cheques }: { cheques: OpenDebit[] }) {
  if (cheques.length === 0) {
    return <div className="text-xs text-slate-500 italic px-2">No cheques in the selected horizon.</div>;
  }
  const total = cheques.reduce((s, c) => s + c.outstanding, 0);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-semibold flex justify-between">
        <span>{cheques.length} cheque{cheques.length === 1 ? "" : "s"}</span>
        <span>
          Outstanding total: <span className="text-rose-700 normal-case font-bold">{money(total)}</span>
        </span>
      </div>
      <table className="min-w-full text-[11px]">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-600">
            <th className="px-3 py-1.5 font-medium">Date</th>
            <th className="px-3 py-1.5 font-medium">Reference</th>
            <th className="px-3 py-1.5 font-medium">Type</th>
            <th className="px-3 py-1.5 font-medium text-right">Cheque Amount</th>
            <th className="px-3 py-1.5 font-medium text-right">Cleared</th>
            <th className="px-3 py-1.5 font-medium text-right">Outstanding</th>
            <th className="px-3 py-1.5 font-medium text-right">Days to Clear</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cheques.map((c, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-3 py-1.5 whitespace-nowrap">{c.date}</td>
              <td className="px-3 py-1.5">{c.reference_number || "—"}</td>
              <td className="px-3 py-1.5">{c.transaction_type}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{money(c.debit_amt)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{money(c.paid_amount)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-rose-700 font-medium">{money(c.outstanding)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {c.days_to_clear === null
                  ? "—"
                  : c.days_to_clear < 0
                  ? <span className="text-rose-700 font-medium">{c.days_to_clear}</span>
                  : c.days_to_clear}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    c.status === "Paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : c.status === "Partial"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChequeListTable({ rows, horizon }: { rows: OpenDebit[]; horizon: Horizon }) {
  const total = rows.reduce((s, r) => s + r.outstanding, 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 text-sm font-medium text-slate-700 flex justify-between">
        <span>
          {horizon === "All"
            ? `Open cheques (${rows.length})`
            : `Open cheques due ${horizon} (${rows.length})`}
        </span>
        <span className="text-slate-500">
          Outstanding total: <span className="text-rose-700 font-bold">{money(total)}</span>
        </span>
      </div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium text-right">Cheque Amount</th>
              <th className="px-4 py-2 font-medium text-right">Cleared</th>
              <th className="px-4 py-2 font-medium text-right">Outstanding</th>
              <th className="px-4 py-2 font-medium text-right">Days to Clear</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap">{c.date}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{c.vendor}</td>
                <td className="px-4 py-2">{c.reference_number || "—"}</td>
                <td className="px-4 py-2">{c.transaction_type}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(c.debit_amt)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{money(c.paid_amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-700 font-medium">{money(c.outstanding)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {c.days_to_clear === null
                    ? "—"
                    : c.days_to_clear < 0
                    ? <span className="text-rose-700 font-medium">{c.days_to_clear}</span>
                    : c.days_to_clear}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      c.status === "Paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : c.status === "Partial"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                  No open cheques match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
