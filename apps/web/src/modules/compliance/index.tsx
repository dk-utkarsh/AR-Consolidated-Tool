import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyzeForm from "./components/AnalyzeForm";
import ResultView from "./components/ResultView";
import Gst2bReco from "./components/Gst2bReco";
import { analyze, getStatus } from "./api";
import type { AnalyzeFiles, ComplianceJob } from "./types";

function ComplianceGuard() {
  const [job, setJob] = useState<ComplianceJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  // The worker can briefly drop connections while restarting; don't alarm the
  // user on a single failed poll. Only surface an error after several in a row.
  const failuresRef = useRef(0);

  useEffect(() => {
    if (!job || (job.state !== "running" && job.state !== "queued")) return;
    failuresRef.current = 0;
    const tick = async () => {
      try {
        setJob(await getStatus(job.job_id));
        failuresRef.current = 0;
      } catch (e) {
        failuresRef.current += 1;
        // ~6 consecutive failures (~9s) before giving up — long enough to ride
        // out a worker restart, after which polling resumes and the backend
        // reports the real job state (e.g. an "interrupted" error).
        if (failuresRef.current >= 6) {
          setError(
            `Lost connection to the analysis service: ${(e as Error).message}. ` +
            `The file may be too large for the server — try a smaller file or retry.`,
          );
        }
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
    <Tabs defaultValue="guard">
      <TabsList>
        <TabsTrigger value="guard">ComplianceGuard</TabsTrigger>
        <TabsTrigger value="gst2b">GST 2B Reco</TabsTrigger>
      </TabsList>
      <TabsContent value="guard">
        <ComplianceGuard />
      </TabsContent>
      <TabsContent value="gst2b">
        <Gst2bReco />
      </TabsContent>
    </Tabs>
  );
}
