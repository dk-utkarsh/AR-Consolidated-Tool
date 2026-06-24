import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyzeForm from "./components/AnalyzeForm";
import ResultView from "./components/ResultView";
import Gst2bReco from "./components/Gst2bReco";
import PrepareData from "./components/PrepareData";
import { analyze, getStatus } from "./api";
import type { AnalyzeFiles, ComplianceJob } from "./types";

function ComplianceGuard() {
  const [job, setJob] = useState<ComplianceJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!job || (job.state !== "running" && job.state !== "queued")) return;
    const tick = async () => {
      try {
        setJob(await getStatus(job.job_id));
      } catch (e) {
        setError((e as Error).message);
      }
    };
    pollRef.current = window.setInterval(tick, 1500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [job?.state, job?.job_id]);

  const onSubmit = async (files: AnalyzeFiles) => {
    setError(null);
    try {
      setJob(await analyze(files));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const busy = !!job && (job.state === "running" || job.state === "queued");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">ComplianceGuard</h2>
          <p className="text-xs text-slate-500">
            Cross-check Sales, E-Invoice, E-way Bill and Credit Note data across 17 GST annexures.
          </p>
        </div>
        {job && (
          <button onClick={() => { setJob(null); setError(null); }} className="text-sm text-slate-500 hover:text-slate-700">
            Start over
          </button>
        )}
      </div>

      {!job && <AnalyzeForm busy={busy} onSubmit={onSubmit} />}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {job && <ResultView job={job} />}
    </div>
  );
}

export default function ComplianceModule() {
  return (
    <Tabs defaultValue="prepare">
      <TabsList>
        <TabsTrigger value="prepare">Prepare Data</TabsTrigger>
        <TabsTrigger value="guard">ComplianceGuard</TabsTrigger>
        <TabsTrigger value="gst2b">GST 2B Reco</TabsTrigger>
      </TabsList>
      <TabsContent value="prepare">
        <PrepareData />
      </TabsContent>
      <TabsContent value="guard">
        <ComplianceGuard />
      </TabsContent>
      <TabsContent value="gst2b">
        <Gst2bReco />
      </TabsContent>
    </Tabs>
  );
}
