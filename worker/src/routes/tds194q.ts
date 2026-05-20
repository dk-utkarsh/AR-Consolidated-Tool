import fs from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { requireSession, type SessionedRequest } from "../lib/session";
import { requireModule } from "../lib/permissions";
import { workerDiskPath } from "../lib/store";
import { log } from "../lib/logger";
import { config } from "../lib/config";
import { bifurcate } from "../jobs/tds194q/bifurcate";
import { buildVendorEmailMap } from "../jobs/tds194q/zoho";
import {
  openTransport,
  periodMonthLabel,
  sendOne,
} from "../jobs/tds194q/mailer";
import {
  createJob,
  getJob,
  patchJob,
  patchVendor,
  serializeJob,
  type Vendor,
} from "../jobs/tds194q/store";

const router = Router();

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },          // 50 MB
  storage: multer.memoryStorage(),
});

function periodFromEnv(): { label: string; suffix: string } {
  const label = process.env.TDS_PERIOD_LABEL ?? "01-Mar-2026 to 31-Mar-2026";
  const m = label.match(/(\d{1,2})-([A-Za-z]{3,})-(\d{4})/);
  const suffix = m ? `${m[2].slice(0, 3)}${m[3]}` : "Period";
  return { label, suffix };
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, module: "tds194q" });
});

// ----------------------------------------------------------------
// POST /tds194q/upload  (multipart 'file')
// ----------------------------------------------------------------
router.post(
  "/upload",
  requireSession,
  requireModule("tds194q"),
  upload.single("file"),
  async (req: SessionedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "missing file (multipart field 'file')" });
      return;
    }
    if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
      res.status(400).json({ error: "expected an .xlsx file" });
      return;
    }

    const period = periodFromEnv();
    const jobIdSeed = Date.now().toString(36);
    const outDir = workerDiskPath(path.join("tds194q", jobIdSeed));
    fs.mkdirSync(outDir, { recursive: true });

    const safeSrc = req.file.originalname.replace(/[^A-Za-z0-9._-]/g, "_") || "194Q.xlsx";
    const srcPath = path.join(outDir, safeSrc);
    fs.writeFileSync(srcPath, req.file.buffer);

    let workbooks;
    try {
      workbooks = await bifurcate({
        sourceXlsxPath: srcPath,
        outDir,
        periodLabel: period.label,
        monthYearSuffix: period.suffix,
      });
    } catch (e) {
      log.error("tds.bifurcate.fail", { error: (e as Error).message });
      res.status(500).json({ error: `bifurcation failed: ${(e as Error).message}` });
      return;
    }
    if (workbooks.length === 0) {
      res.status(422).json({ error: "no vendor blocks found in Sheet3" });
      return;
    }

    let emailEntries;
    try {
      emailEntries = await buildVendorEmailMap(workbooks.map((w) => w.vendorName));
    } catch (e) {
      log.error("tds.email_lookup.fail", { error: (e as Error).message });
      res.status(502).json({ error: `zoho vendor lookup failed: ${(e as Error).message}` });
      return;
    }

    const emailByVendor = new Map(emailEntries.map((e) => [e.bifurcatedName, e.email]));
    const vendors: Vendor[] = workbooks.map((w) => {
      const email = emailByVendor.get(w.vendorName) ?? "";
      return {
        name: w.vendorName,
        intendedEmail: email,
        file: w.filename,
        filePath: w.filePath,
        hasEmail: Boolean(email),
        status: "pending",
        error: null,
      };
    });

    const job = createJob({
      createdBy: req.user?.email,
      sourceFilename: safeSrc,
      outDir,
      total: vendors.length,
      vendors,
      periodLabel: period.label,
    });

    log.info("tds.upload.ok", { jobId: job.jobId, vendors: vendors.length, by: req.user?.email });
    res.json(serializeJob(job));
  },
);

// ----------------------------------------------------------------
// GET /tds194q/jobs/:id
// ----------------------------------------------------------------
router.get("/jobs/:id", requireSession, requireModule("tds194q"), (req: SessionedRequest, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  res.json(serializeJob(job));
});

// ----------------------------------------------------------------
// POST /tds194q/jobs/:id/send  — fire-and-forget
// ----------------------------------------------------------------
router.post("/jobs/:id/send", requireSession, requireModule("tds194q"), (req: SessionedRequest, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  if (job.state === "sending") {
    res.status(409).json({ error: "already sending" });
    return;
  }
  if (job.state === "done") {
    res.status(409).json({ error: "already finished" });
    return;
  }

  patchJob(job.jobId, { state: "sending", error: undefined });

  setImmediate(() => runSendBlast(job.jobId).catch((e) => {
    log.error("tds.send.crash", { jobId: job.jobId, error: (e as Error).message });
    patchJob(job.jobId, { state: "error", error: (e as Error).message });
  }));

  res.json({ ok: true });
});

async function runSendBlast(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  const recipient =
    config.mail.testRecipient ||
    "Prabhash.m@dentalkart.com";                     // matches Project 1 TEST_RECIPIENT default

  let transport, sender;
  try {
    ({ transport, sender } = openTransport());
  } catch (e) {
    patchJob(jobId, { state: "error", error: (e as Error).message });
    return;
  }

  const monthLabel = periodMonthLabel(job.periodLabel);
  let sent = 0;
  let failed = 0;
  try {
    for (const vendor of job.vendors) {
      patchVendor(jobId, vendor.name, { status: "sending" });
      try {
        await sendOne(transport, sender, {
          vendorName: vendor.name,
          intendedEmail: vendor.intendedEmail,
          attachmentPath: vendor.filePath,
          attachmentFilename: vendor.file,
          recipient,
          periodMonthLabel: monthLabel,
        });
        sent += 1;
        patchVendor(jobId, vendor.name, { status: "sent", error: null });
        patchJob(jobId, { sent });
      } catch (e) {
        failed += 1;
        const errMsg = (e as Error).message;
        patchVendor(jobId, vendor.name, { status: "failed", error: errMsg });
        patchJob(jobId, { failed });
        log.warn("tds.send.vendor_fail", { jobId, vendor: vendor.name, error: errMsg });
      }
    }
    patchJob(jobId, { state: "done", sent, failed });
    log.info("tds.send.done", { jobId, sent, failed });
  } finally {
    try { transport.close(); } catch { /* ignore */ }
  }
}

// ----------------------------------------------------------------
// GET /tds194q/jobs/:id/preview/:filename
// ----------------------------------------------------------------
router.get(
  "/jobs/:id/preview/:filename",
  requireSession,
  requireModule("tds194q"),
  async (req: SessionedRequest, res: Response) => {
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

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const ws = wb.worksheets[0];
      if (!ws) {
        res.status(500).json({ error: "no worksheet" });
        return;
      }

      const rows: unknown[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const values = row.values as unknown[];
        rows.push(values.slice(1));                  // strip the 1-index undefined
      });

      const cellToStr = (v: unknown): string | number | null => {
        if (v === null || v === undefined || v === "") return null;
        if (v instanceof Date) {
          // dd-MMM-yyyy
          const d = v;
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          return `${String(d.getDate()).padStart(2,"0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
        }
        if (typeof v === "number" && Number.isInteger(v)) return v;
        if (typeof v === "number") return v;
        if (typeof v === "string") return v;
        if (typeof v === "object") {
          const obj = v as { result?: unknown; text?: string };
          if ("result" in obj) return cellToStr(obj.result);
          if ("text" in obj && typeof obj.text === "string") return obj.text;
        }
        return null;
      };

      const norm = rows.map((r) => r.map(cellToStr));
      const title = (norm[0]?.[0] ?? "") as string;
      const subtitle = (norm[1]?.[0] ?? "") as string;

      let header: Array<string | number | null> = [];
      let body: Array<Array<string | number | null>> = [];
      let totalRow: Array<string | number | null> = [];

      if (norm.length >= 5) {
        header = (norm[3] ?? []).filter((c) => c !== null && c !== "");
        const after = norm.slice(4);
        if (after.length > 0) {
          totalRow = after[after.length - 1] ?? [];
          const dataRows = after.slice(0, -1);
          const ncols = header.length || Math.max(...after.map((r) => r.length), 0);
          body = dataRows.map((r) => r.slice(0, ncols));
          totalRow = totalRow.slice(0, ncols);
        }
      }

      res.json({
        filename,
        title,
        subtitle,
        header,
        rows: body,
        total: totalRow,
      });
    } catch (e) {
      res.status(500).json({ error: `could not read xlsx: ${(e as Error).message}` });
    }
  },
);

// ----------------------------------------------------------------
// GET /tds194q/jobs/:id/download/:filename
// ----------------------------------------------------------------
router.get(
  "/jobs/:id/download/:filename",
  requireSession,
  requireModule("tds194q"),
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

export default router;
