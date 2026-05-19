import { useEffect, useState } from "react";
import { fetchCustomer } from "../api";
import { money } from "../format";
import type { CustomerDetail, DashboardData } from "../types";

interface Props {
  data: DashboardData;
  asOf: string;
}

export default function DrillDownTab({ data, asOf }: Props) {
  const customers = data.summary.map((s) => s.customer);
  const [selected, setSelected] = useState<string>(customers[0] ?? "");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchCustomer(selected, asOf)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected, asOf]);

  if (customers.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">No customers.</div>;
  }

  const cheques = detail?.cheques ?? [];
  const total = cheques.reduce((s, r) => s + r.debit_amt, 0);
  const cleared = cheques.reduce((s, r) => s + r.paid_amount, 0);
  const open = cheques.reduce((s, r) => s + r.outstanding, 0);
  const pct = total ? (cleared / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <label className="text-xs text-slate-600 mb-1 block">Pick a customer to inspect every cheque</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
        >
          {customers.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && !detail && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Loading…</div>
      )}

      {detail && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Total Issued" value={money(total)} />
            <Mini label="Cleared" value={money(cleared)} tone="emerald" />
            <Mini label="Outstanding" value={money(open)} tone="rose" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{pct.toFixed(1)}% cleared</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-2 font-medium">Cheque Date</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Entity #</th>
                    <th className="px-4 py-2 font-medium text-right">Cheque Amount</th>
                    <th className="px-4 py-2 font-medium text-right">Cleared</th>
                    <th className="px-4 py-2 font-medium text-right">Outstanding</th>
                    <th className="px-4 py-2 font-medium text-right">Days to Clear</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cheques.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2">{c.date}</td>
                      <td className="px-4 py-2">{c.reference_number}</td>
                      <td className="px-4 py-2">{c.transaction_type}</td>
                      <td className="px-4 py-2">{c.entity_number}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(c.debit_amt)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{money(c.paid_amount)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-rose-700 font-medium">
                        {money(c.outstanding)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {c.days_to_clear === null ? "—" : c.days_to_clear}
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
                  {cheques.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                        No cheques for this customer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const cls =
    tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white py-3 text-center">
      <div className={`text-xl font-semibold ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
