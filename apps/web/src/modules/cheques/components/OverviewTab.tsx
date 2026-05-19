import { useState } from "react";
import { AgingChart, CustomerBar, StatusDonut, TimelineChart } from "./Charts";
import { money } from "../format";
import type { DashboardData } from "../types";

interface Props {
  data: DashboardData;
}

type Horizon = 2 | 6 | 15;

export default function OverviewTab({ data }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(15);
  const [showOverdue, setShowOverdue] = useState(true);

  const horizonSubset = data.open_debits.filter((d) => {
    const dtc = d.days_to_clear ?? -1;
    return dtc >= 0 && dtc <= horizon;
  });
  const overdueSubset = data.open_debits.filter((d) => (d.days_to_clear ?? Infinity) < 0);

  const h_total = horizonSubset.reduce((s, d) => s + d.outstanding, 0);
  const h_vendors = new Set(horizonSubset.map((d) => d.vendor)).size;
  const h_cheques = horizonSubset.length;

  const o_total = overdueSubset.reduce((s, d) => s + d.outstanding, 0);
  const o_vendors = new Set(overdueSubset.map((d) => d.vendor)).size;
  const o_cheques = overdueSubset.length;

  const totalOverdue = data.summary.reduce((s, r) => s + r.overdue, 0);
  const totalDue15 = data.summary.reduce((s, r) => s + r.due_in_15d, 0);
  const totalDue6 = data.summary.reduce((s, r) => s + r.due_in_6d, 0);
  const totalDue2 = data.summary.reduce((s, r) => s + r.due_in_2d, 0);

  const buckets = showOverdue
    ? ["Overdue", "Due in ≤2d", "Due in ≤6d", "Due in ≤15d"]
    : ["Due in ≤2d", "Due in ≤6d", "Due in ≤15d"];
  const amounts = showOverdue
    ? [totalOverdue, totalDue2, totalDue6, totalDue15]
    : [totalDue2, totalDue6, totalDue15];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Consolidated horizon</h3>
            <p className="text-xs text-slate-500">
              Show total for cheques due within:
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
            {([2, 6, 15] as Horizon[]).map((h) => (
              <label key={h} className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="radio"
                  name="overview-horizon"
                  value={h}
                  checked={horizon === h}
                  onChange={() => setHorizon(h)}
                  className="accent-indigo-600"
                />
                ≤ {h} days
              </label>
            ))}
            <label className="ml-3 flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOverdue}
                onChange={(e) => setShowOverdue(e.target.checked)}
                className="accent-indigo-600"
              />
              Show Overdue
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Mini label={`Total due ≤ ${horizon} days`} value={money(h_total)} />
          <Mini label="Customers" value={String(h_vendors)} />
          <Mini label="Open cheques" value={String(h_cheques)} />
        </div>
      </div>

      <CustomerBar
        data={horizonSubset}
        title={`Customer-wise — ≤ ${horizon} days`}
        color="#2563eb"
        empty={`No cheques due in next ${horizon} day(s).`}
      />

      {showOverdue && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">🔴 Overdue (across all customers)</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini label="Total overdue" value={money(o_total)} />
              <Mini label="Customers" value={String(o_vendors)} />
              <Mini label="Open cheques" value={String(o_cheques)} />
            </div>
          </div>
          <CustomerBar
            data={overdueSubset}
            title="Overdue by customer"
            color="#dc2626"
            empty="No overdue cheques."
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <AgingChart buckets={buckets} amounts={amounts} />
        </div>
        <StatusDonut data={data} />
      </div>

      <TimelineChart openDebits={data.open_debits} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
