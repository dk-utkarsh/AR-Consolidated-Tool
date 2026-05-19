import { useEffect } from "react";
import type { Job } from "../types";

interface Props {
  job: Job;
}

interface StatProps {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "slate";
}

function Stat({ label, value, tone }: StatProps) {
  const tones: Record<StatProps["tone"], string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-lg py-3 ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
    </div>
  );
}

export default function SendProgress({ job }: Props) {
  const { state, total, sent, failed, vendors, error } = job;

  // Warn if user tries to close/reload mid-send.
  useEffect(() => {
    if (state !== "sending") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  const done = sent + failed;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const stateLabel = ({
    sending: "Sending…",
    done: "All done",
    error: "Error",
  } as Record<string, string>)[state] ?? state;

  const stateClass = ({
    sending: "bg-indigo-100 text-indigo-700",
    done: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  } as Record<string, string>)[state] ?? "bg-slate-100 text-slate-700";

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Sending progress</h2>
          <p className="text-sm text-slate-500">
            All mails are routed to <code className="px-1 py-0.5 bg-slate-100 rounded">Prabhash.m@dentalkart.com</code> for testing.
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stateClass}`}>
          {stateLabel}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{done} / {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${state === "error" ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <Stat label="Sent" value={sent} tone="emerald" />
        <Stat label="Failed" value={failed} tone="rose" />
        <Stat label="Remaining" value={Math.max(total - done, 0)} tone="slate" />
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="border border-slate-100 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">Live log</div>
        <div className="max-h-72 overflow-y-auto font-mono text-xs">
          {vendors.map((v, i) => {
            let line = "·";
            let cls = "text-slate-500";
            if (v.status === "sent") { line = "✓"; cls = "text-emerald-600"; }
            else if (v.status === "failed") { line = "✗"; cls = "text-rose-600"; }
            else if (v.status === "sending") { line = "…"; cls = "text-indigo-600"; }
            else if (v.status === "pending") { line = "·"; cls = "text-slate-400"; }
            return (
              <div key={v.name} className="px-4 py-1.5 flex gap-3 border-t border-slate-50">
                <span className={`${cls} w-4`}>{line}</span>
                <span className="text-slate-400 w-14">[{i + 1}/{vendors.length}]</span>
                <span className="text-slate-700 flex-1 truncate">{v.name}</span>
                <span className="text-slate-400 truncate max-w-xs">
                  {v.error ? <span className="text-rose-600">{v.error}</span> : (v.intended_email || "no email")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
