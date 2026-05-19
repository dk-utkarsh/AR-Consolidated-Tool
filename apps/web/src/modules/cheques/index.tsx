import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchDashboard, refreshFromZoho } from "./api";
import { todayIso } from "./format";
import type { DashboardData } from "./types";
import KpiCards from "./components/KpiCards";
import OverviewTab from "./components/OverviewTab";
import CustomersTab from "./components/CustomersTab";
import DrillDownTab from "./components/DrillDownTab";
import ClosedCasesTab from "./components/ClosedCasesTab";
import UploadChequeTab from "./components/UploadChequeTab";

export default function ChequesModule() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asOf, setAsOf] = useState<string>(todayIso());

  const load = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchDashboard(date);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(asOf);
  }, [asOf, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshFromZoho();
      await load(asOf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">Cheque In Hand</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.meta ? (
              <>Pulled {new Date(data.meta.pulledAt).toLocaleString()} · {data.meta.rows} rows</>
            ) : (
              <>Source: Zoho Books · Cheque In hand / issued to vendor</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            As of
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-xs"
            />
          </label>
          <Button onClick={onRefresh} disabled={refreshing} size="sm" variant="outline">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!data && loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading dashboard…
        </div>
      )}

      {data && data.meta === null && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-6 text-center text-amber-800">
          No cheque data yet. Click <strong>Refresh from Zoho</strong> to pull the latest.
        </div>
      )}

      {data && data.meta && (
        <>
          <KpiCards data={data} />

          <Tabs defaultValue="customers">
            <TabsList>
              <TabsTrigger value="upload">📤 Upload Cheque</TabsTrigger>
              <TabsTrigger value="overview">📊 Overview</TabsTrigger>
              <TabsTrigger value="customers">👥 Customers ({data.summary.length})</TabsTrigger>
              <TabsTrigger value="drill">🧾 Cheque drill-down</TabsTrigger>
              <TabsTrigger value="closed">📁 Closed Cases ({data.orphans.length + data.auto_closed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upload"><UploadChequeTab /></TabsContent>
            <TabsContent value="overview"><OverviewTab data={data} /></TabsContent>
            <TabsContent value="customers"><CustomersTab data={data} /></TabsContent>
            <TabsContent value="drill"><DrillDownTab data={data} asOf={asOf} /></TabsContent>
            <TabsContent value="closed"><ClosedCasesTab data={data} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
