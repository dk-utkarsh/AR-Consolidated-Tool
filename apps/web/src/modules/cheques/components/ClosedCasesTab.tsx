import { money } from "../format";
import type { ClosedCase, DashboardData } from "../types";

interface Props {
  data: DashboardData;
}

export default function ClosedCasesTab({ data }: Props) {
  const orphans = data.orphans;
  const autoClosed = data.auto_closed;

  if (orphans.length === 0 && autoClosed.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-6 text-center text-emerald-800">
        🎉 All credits are matched to a debit. No closed cases.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orphans.length > 0 && (
        <Section
          title={`${orphans.length} closed case(s) — credits with no matching debit`}
          tone="warning"
          rows={orphans}
        />
      )}
      {autoClosed.length > 0 && (
        <Section
          title={`✅ ${autoClosed.length} credit(s) auto-closed via net_amount = credit rule`}
          tone="info"
          rows={autoClosed}
        />
      )}
    </div>
  );
}

function Section({ title, rows, tone }: { title: string; rows: ClosedCase[]; tone: "warning" | "info" }) {
  const headerCls =
    tone === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-sky-50 border-sky-200 text-sky-900";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-2 text-sm font-medium border-b ${headerCls}`}>{title}</div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium text-right">Credit</th>
              <th className="px-4 py-2 font-medium text-right">Unmatched</th>
              <th className="px-4 py-2 font-medium">net_amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2">{r.customer}</td>
                <td className="px-4 py-2">{r.transaction_type}</td>
                <td className="px-4 py-2">{r.reference_number}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(r.credit_amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-700">{money(r.unmatched_credit)}</td>
                <td className="px-4 py-2 text-slate-600">{r.net_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
