import fs from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import { requireSession, type SessionedRequest } from "../lib/session";
import { requireModule } from "../lib/permissions";
import { workerDiskPath } from "../lib/store";
import { log } from "../lib/logger";
import { generateReport, type ComplianceInputs } from "../jobs/compliance/report";
import { clearWorkbookCache } from "../jobs/compliance/excel";
import { createJob, getJob, patchJob, serializeJob } from "../jobs/compliance/store";
import {
  generateSample, SAMPLE_FILENAMES, SAMPLE_KINDS, type SampleKind,
} from "../jobs/compliance/samples";
import { runReconciliation } from "../jobs/gst2b/reconcile";
import {
  generateGst2bSample, GST2B_SAMPLE_FILENAMES, GST2B_SAMPLE_KINDS, type Gst2bSampleKind,
} from "../jobs/gst2b/samples";

const router = Router();

// Uploads are streamed to a temp dir on disk rather than buffered in RAM.
// On the 512MB Render instance, holding several 100MB+ workbooks in the heap
// was enough to get the process OOM-killed mid-job; the readers stream these
// files straight from disk instead. Temp files are deleted once the job ends.
const UPLOAD_TMP = workerDiskPath("uploads");

// Sales workbooks can be very large (100MB+); allow generous per-file limits.
const upload = multer({
  limits: { fileSize: 300 * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOAD_TMP, { recursive: true });
      cb(null, UPLOAD_TMP);
    },
  }),
});

/** Collect every uploaded temp-file path so it can be deleted after the job. */
function uploadedPaths(files: Files): string[] {
  return Object.values(files)
    .flatMap((arr) => arr ?? [])
    .map((f) => f.path)
    .filter(Boolean);
}

/** Best-effort removal of temp upload files; never throws. */
function cleanupUploads(paths: string[]): void {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch { /* already gone */ }
  }
}

const ANALYZE_FIELDS = [
  { name: "sales_file", maxCount: 1 },
  { name: "einvoice_file", maxCount: 1 },
  { name: "ewaybill_file", maxCount: 1 },
  { name: "creditnote_file", maxCount: 1 },
  { name: "cn_einvoice_file", maxCount: 1 },
];

type Files = Record<string, Express.Multer.File[] | undefined>;

function firstPath(files: Files, field: string): string | null {
  const f = files[field]?.[0];
  return f ? f.path : null;
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, module: "compliance" });
});

// ----------------------------------------------------------------
// POST /compliance/analyze  (multipart; sales_file + einvoice_file required)
// ----------------------------------------------------------------
router.post(
  "/analyze",
  requireSession,
  requireModule("compliance"),
  upload.fields(ANALYZE_FIELDS),
  async (req: SessionedRequest, res: Response) => {
    const files = (req.files ?? {}) as Files;
    const tmpPaths = uploadedPaths(files);
    const sales = firstPath(files, "sales_file");
    const einvoice = firstPath(files, "einvoice_file");
    if (!sales) {
      cleanupUploads(tmpPaths);
      res.status(400).json({ error: "missing file (multipart field 'sales_file')" });
      return;
    }
    if (!einvoice) {
      cleanupUploads(tmpPaths);
      res.status(400).json({ error: "missing file (multipart field 'einvoice_file')" });
      return;
    }

    const jobIdSeed = Date.now().toString(36);
    const outDir = workerDiskPath(path.join("compliance", jobIdSeed));
    fs.mkdirSync(outDir, { recursive: true });

    const job = createJob({ createdBy: req.user?.email, outDir });

    const inputs: ComplianceInputs = {
      sales,
      einvoice,
      ewaybill: firstPath(files, "ewaybill_file"),
      creditnote: firstPath(files, "creditnote_file"),
      cnEinvoice: firstPath(files, "cn_einvoice_file"),
    };

    log.info("compliance.analyze.start", { jobId: job.jobId, by: req.user?.email });

    // Fire-and-forget; the browser polls GET /compliance/jobs/:id.
    setImmediate(async () => {
      patchJob(job.jobId, { state: "running", pct: 5, msg: "Reading Sales data..." });
      try {
        const result = await generateReport(inputs, outDir, jobIdSeed, (pct, msg) => {
          patchJob(job.jobId, { state: "running", pct, msg });
        });
        patchJob(job.jobId, { state: "done", pct: 100, msg: "", result });
        log.info("compliance.analyze.done", { jobId: job.jobId, file: result.filename });
      } catch (e) {
        const msg = (e as Error).message;
        log.error("compliance.analyze.fail", { jobId: job.jobId, error: msg });
        patchJob(job.jobId, { state: "error", error: msg });
      } finally {
        clearWorkbookCache(tmpPaths);
        cleanupUploads(tmpPaths);
      }
    });

    res.json(serializeJob(job));
  },
);

// ----------------------------------------------------------------
// GET /compliance/jobs/:id
// ----------------------------------------------------------------
router.get("/jobs/:id", requireSession, requireModule("compliance"), (req: SessionedRequest, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  res.json(serializeJob(job));
});

// ----------------------------------------------------------------
// GET /compliance/jobs/:id/download/:filename
// ----------------------------------------------------------------
router.get(
  "/jobs/:id/download/:filename",
  requireSession,
  requireModule("compliance"),
  (req: SessionedRequest, res: Response) => {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "unknown job" });
      return;
    }
    const filename = path.basename(req.params.filename);
    const file = path.join(job.outDir, filename);
    if (!file.startsWith(job.outDir) || !fs.existsSync(file)) {
      res.status(404).json({ error: "file not found" });
      return;
    }
    res.download(file, filename);
  },
);

// ----------------------------------------------------------------
// GET /compliance/samples/:kind  — download a template/sample file
// ----------------------------------------------------------------
router.get(
  "/samples/:kind",
  requireSession,
  requireModule("compliance"),
  async (req: SessionedRequest, res: Response) => {
    const kind = req.params.kind as SampleKind;
    if (!SAMPLE_KINDS.includes(kind)) {
      res.status(404).json({ error: "unknown sample" });
      return;
    }
    try {
      const buf = await generateSample(kind);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${SAMPLE_FILENAMES[kind]}`);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: `sample generation failed: ${(e as Error).message}` });
    }
  },
);

// ================================================================
// GST 2B Reconciliation (synchronous — 2B vs Purchase Register)
// ================================================================
const GST2B_FIELDS = [
  { name: "file_2b", maxCount: 1 },
  { name: "file_pr", maxCount: 1 },
];

function gst2bDir(): string {
  const dir = workerDiskPath(path.join("gst2b", "outputs"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

router.post(
  "/gst2b/reconcile",
  requireSession,
  requireModule("compliance"),
  upload.fields(GST2B_FIELDS),
  async (req: SessionedRequest, res: Response) => {
    const files = (req.files ?? {}) as Files;
    const tmpPaths = uploadedPaths(files);
    const file2b = firstPath(files, "file_2b");
    const filePr = firstPath(files, "file_pr");
    if (!file2b) { cleanupUploads(tmpPaths); res.status(400).json({ error: "missing file (multipart field 'file_2b')" }); return; }
    if (!filePr) { cleanupUploads(tmpPaths); res.status(400).json({ error: "missing file (multipart field 'file_pr')" }); return; }

    const idSeed = Date.now().toString(36);
    try {
      const result = await runReconciliation(file2b, filePr, gst2bDir(), idSeed);
      log.info("gst2b.reconcile.ok", { by: req.user?.email, file: result.filename });
      res.json({
        success: true,
        summary: result.summary,
        filename: result.filename,
        download_url: `/compliance/gst2b/download/${encodeURIComponent(result.filename)}`,
      });
    } catch (e) {
      const msg = (e as Error).message;
      log.error("gst2b.reconcile.fail", { error: msg });
      res.status(400).json({ success: false, error: msg });
    } finally {
      clearWorkbookCache(tmpPaths);
      cleanupUploads(tmpPaths);
    }
  },
);

router.get(
  "/gst2b/download/:filename",
  requireSession,
  requireModule("compliance"),
  (req: SessionedRequest, res: Response) => {
    const dir = gst2bDir();
    const filename = path.basename(req.params.filename);
    const file = path.join(dir, filename);
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.status(404).json({ error: "file not found" });
      return;
    }
    res.download(file, filename);
  },
);

router.get(
  "/gst2b/samples/:kind",
  requireSession,
  requireModule("compliance"),
  async (req: SessionedRequest, res: Response) => {
    const kind = req.params.kind as Gst2bSampleKind;
    if (!GST2B_SAMPLE_KINDS.includes(kind)) {
      res.status(404).json({ error: "unknown sample" });
      return;
    }
    try {
      const buf = await generateGst2bSample(kind);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${GST2B_SAMPLE_FILENAMES[kind]}`);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: `sample generation failed: ${(e as Error).message}` });
    }
  },
);

export default router;
