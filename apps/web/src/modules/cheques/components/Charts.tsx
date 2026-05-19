import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { money, moneyCompact } from "../format";
import type { DashboardData, OpenDebit } from "../types";

interface AgingProps {
  buckets: string[];
  amounts: number[];
}

const AGING_COLORS: Record<string, string> = {
  Overdue: "#dc2626",
  "Due in ≤2d": "#f59e0b",
  "Due in ≤6d": "#3b82f6",
  "Due in ≤15d": "#10b981",
};

export function AgingChart({ buckets, amounts }: AgingProps) {
  const data = buckets.map((b, i) => ({ bucket: b, amount: amounts[i] ?? 0 }));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Aging (across visible customers)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v: number) => money(v)}
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={AGING_COLORS[d.bucket] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ data }: { data: DashboardData }) {
  const out = data.summary
    .filter((s) => s.status === "Outstanding")
    .reduce((s, r) => s + r.balance_outstanding, 0);
  const cleared = data.summary.reduce((s, r) => s + r.total_cleared, 0);
  const rows = [
    { name: "Cleared", value: cleared, fill: "#10b981" },
    { name: "Outstanding", value: out, fill: "#ef4444" },
  ].filter((r) => r.value > 0);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
        No data.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Cleared vs Outstanding</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimelineChart({ openDebits }: { openDebits: OpenDebit[] }) {
  const horizon = openDebits.filter((d) => {
    const dtc = d.days_to_clear ?? -1;
    return dtc >= 0 && dtc <= 30;
  });
  if (horizon.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
        No cheques due in the next 30 days.
      </div>
    );
  }
  const byDay = new Map<string, number>();
  for (const d of horizon) {
    byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.outstanding);
  }
  const rows = Array.from(byDay.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Daily cheque inflow (next 30 days)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={(s: string) => s.slice(5)} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v: number) => money(v)}
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomerBar({
  data,
  title,
  color,
  empty,
}: {
  data: OpenDebit[];
  title: string;
  color: string;
  empty: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
        {empty}
      </div>
    );
  }
  const byCust = new Map<string, { amount: number; cheques: number }>();
  for (const d of data) {
    const cur = byCust.get(d.vendor) ?? { amount: 0, cheques: 0 };
    cur.amount += d.outstanding;
    cur.cheques += 1;
    byCust.set(d.vendor, cur);
  }
  const rows = Array.from(byCust.entries())
    .map(([customer, v]) => ({ customer, amount: v.amount, cheques: v.cheques }))
    .sort((a, b) => b.amount - a.amount);
  const height = Math.max(220, 28 * rows.length);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart layout="vertical" data={rows} margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={moneyCompact} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="customer" width={180} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v: number) => money(v)}
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="amount" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
