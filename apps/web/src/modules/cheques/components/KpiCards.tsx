import { money } from "../format";
import type { DashboardData } from "../types";

interface Props {
  data: DashboardData;
}

export default function KpiCards({ data }: Props) {
  const { summary, open_debits } = data;
  const total_outstanding = summary
    .filter((s) => s.status === "Outstanding")
    .reduce((s, r) => s + r.balance_outstanding, 0);
  const total_overdue = summary.reduce((s, r) => s + r.overdue, 0);
  const total_due_15 = summary.reduce((s, r) => s + r.due_in_15d, 0);
  const n_outstanding_vendors = summary.filter((s) => s.status === "Outstanding").length;
  const total_issued = summary.reduce((s, r) => s + r.total_issued, 0);
  const total_cleared = summary.reduce((s, r) => s + r.total_cleared, 0);
  const cleared_pct = total_issued ? (total_cleared / total_issued) * 100 : 0;
  const n_open_cheques = summary.reduce((s, r) => s + r.open_cheques, 0);
  const n_overdue_cheques = open_debits.filter(
    (d) => (d.days_to_clear ?? Infinity) < 0,
  ).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Outstanding Balance" value={money(total_outstanding)} />
        <Kpi
          label="Overdue"
          value={money(total_overdue)}
          sub={`${n_overdue_cheques} cheque${n_overdue_cheques === 1 ? "" : "s"}`}
          tone="rose"
        />
        <Kpi label="Due in next 15 days" value={money(total_due_15)} tone="indigo" />
        <Kpi
          label="Customers with open cheques"
          value={String(n_outstanding_vendors)}
          sub={`${n_open_cheques} open cheques`}
        />
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>
            Cleared {cleared_pct.toFixed(1)}% of total issued · {money(total_cleared)} of {money(total_issued)}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
            style={{ width: `${Math.min(cleared_pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rose" | "indigo" }) {
  const valueClass =
    tone === "rose" ? "text-rose-700" : tone === "indigo" ? "text-indigo-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
