import { useEffect, useRef, useState } from "react";
import UploadStep from "./components/UploadStep";
import VendorTable from "./components/VendorTable";
import SendProgress from "./components/SendProgress";
import { getStatus, startSend } from "./api";
import type { Job } from "./types";

const TEST_RECIPIENT = "Prabhash.m@dentalkart.com";

export default function Tds194qModule() {
  const [job, setJob] = useState<Job | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!job || job.state !== "sending") return;
    const tick = async () => {
      try {
        const next = await getStatus(job.job_id);
        setJob(next);
      } catch (e) {
        setSendError((e as Error).message);
      }
    };
    pollRef.current = window.setInterval(tick, 1000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [job?.state, job?.job_id]);

  const onUploaded = (j: Job) => {
    setJob(j);
    setSendError(null);
  };

  const onSendAll = async () => {
    if (!job) return;
    setConfirming(false);
    setSendError(null);
    try {
      await startSend(job.job_id);
      setJob((prev) => (prev ? { ...prev, state: "sending" } : prev));
    } catch (e) {
      setSendError((e as Error).message);
    }
  };

  const reset = () => {
    setJob(null);
    setSendError(null);
    setConfirming(false);
  };

  const showProgress = job && job.state !== "uploaded";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">194Q TDS Vendor Mailer</h2>
          <p className="text-xs text-slate-500">Bifurcate per vendor and email each their slice.</p>
        </div>
        {job && (
          <button
            onClick={reset}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Start over
          </button>
        )}
      </div>

      {!job && <UploadStep onUploaded={onUploaded} />}

      {job && (
        <>
          <VendorTable job={job} />

          {sendError && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {sendError}
            </div>
          )}

          {job.state === "uploaded" && (
            <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">Ready to send</div>
                <div className="text-sm text-slate-500">
                  All {job.total} mails will be routed to{" "}
                  <code className="px-1 py-0.5 bg-slate-100 rounded">{TEST_RECIPIENT}</code>{" "}
                  (test mode). Don't refresh the page until it finishes.
                </div>
              </div>
              <button
                onClick={() => setConfirming(true)}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
              >
                Send All Emails
              </button>
            </div>
          )}

          {showProgress && <SendProgress job={job} />}
        </>
      )}

      {confirming && job && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Send {job.total} emails?</h3>
            <p className="text-sm text-slate-600 mt-2">
              All emails will be sent to <strong>{TEST_RECIPIENT}</strong> for testing.
              Each mail mentions the vendor's actual email in the body.
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
              Keep this tab open until sending finishes.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={onSendAll}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                Yes, send all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
