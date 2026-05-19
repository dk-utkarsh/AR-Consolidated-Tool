import { Router, type Response } from "express";
import multer from "multer";
import { requireSession, type SessionedRequest } from "../lib/session";
import { log } from "../lib/logger";
import { pullChequeTransactions } from "../jobs/cheques/zoho-puller";
import { buildDashboard, customerDetail } from "../jobs/cheques/fifo";
import { lookupCheque } from "../jobs/cheques/lookup";
import { createCustomerPayment, lookupPaymentsForCheque } from "../jobs/cheques/zoho-payments";

const router = Router();

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 },          // 20 MB per cheque image
  storage: multer.memoryStorage(),
});

router.get("/health", (_req, res) => {
  res.json({ ok: true, module: "cheques" });
});

router.post("/refresh", requireSession, async (req: SessionedRequest, res: Response) => {
  try {
    const result = await pullChequeTransactions();
    log.info("cheques.refresh.ok", { by: req.user?.email, rows: result.rows });
    res.json({ ok: true, ...result });
  } catch (e) {
    const msg = (e as Error).message;
    log.error("cheques.refresh.fail", { error: msg });
    res.status(502).json({ error: msg });
  }
});

function asOfFromQuery(req: SessionedRequest): string {
  return typeof req.query.as_of === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.as_of)
    ? req.query.as_of
    : new Date().toISOString().slice(0, 10);
}

router.get("/dashboard", requireSession, (req: SessionedRequest, res: Response) => {
  try {
    res.json(buildDashboard(asOfFromQuery(req)));
  } catch (e) {
    const msg = (e as Error).message;
    log.error("cheques.dashboard.fail", { error: msg });
    res.status(500).json({ error: `dashboard failed: ${msg}` });
  }
});

router.post(
  "/ocr",
  requireSession,
  upload.single("image"),
  async (req: SessionedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "missing file (multipart field 'image')" });
      return;
    }
    const filename = req.file.originalname || "cheque.jpg";
    try {
      const result = await lookupCheque(req.file.buffer, filename);
      log.info("cheques.ocr.ok", {
        by: req.user?.email,
        file: filename,
        cheque_no: result.fields.cheque_number,
        matches: result.matches.length,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      log.error("cheques.ocr.fail", { error: msg });
      res.status(500).json({ error: `OCR failed: ${msg}` });
    }
  },
);

router.post(
  "/lookup",
  requireSession,
  async (req: SessionedRequest, res: Response) => {
    const body = (req.body ?? {}) as {
      cheque_number?: unknown;
      cheque_date?: unknown;
      amount?: unknown;
      vendor_name?: unknown;
    };
    const chequeNo = typeof body.cheque_number === "string" ? body.cheque_number.trim() : "";
    if (!chequeNo) {
      res.status(400).json({ error: "cheque_number is required" });
      return;
    }
    const chequeDate = typeof body.cheque_date === "string" && body.cheque_date.trim() ? body.cheque_date.trim() : null;
    const vendorName = typeof body.vendor_name === "string" && body.vendor_name.trim() ? body.vendor_name.trim() : null;
    let amount: number | null = null;
    if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
      amount = body.amount;
    } else if (typeof body.amount === "string" && body.amount.trim()) {
      const n = Number(body.amount.replace(/[,₹\s]/g, ""));
      if (Number.isFinite(n)) amount = n;
    }
    try {
      const result = await lookupPaymentsForCheque({ chequeNo, chequeDate, amount, vendorName });
      log.info("cheques.lookup.ok", { by: req.user?.email, cheque_no: chequeNo, matches: result.matches.length });
      res.json({
        fields: { cheque_number: chequeNo, cheque_date: chequeDate, amount, vendor_name: vendorName },
        matches: result.matches,
        rejected: result.rejected,
        total_candidates: result.total_candidates,
      });
    } catch (e) {
      const msg = (e as Error).message;
      log.error("cheques.lookup.fail", { error: msg });
      res.status(502).json({ error: msg });
    }
  },
);

router.post("/create-payment", requireSession, async (req: SessionedRequest, res: Response) => {
  const body = (req.body ?? {}) as {
    cheque_number?: unknown;
    cheque_date?: unknown;
    amount?: unknown;
    vendor_name?: unknown;
    skip_duplicate_check?: unknown;
  };
  const chequeNo = typeof body.cheque_number === "string" ? body.cheque_number.trim() : "";
  const chequeDate = typeof body.cheque_date === "string" ? body.cheque_date.trim() : "";
  const vendorName = typeof body.vendor_name === "string" ? body.vendor_name.trim() : "";
  let amount = 0;
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    amount = body.amount;
  } else if (typeof body.amount === "string" && body.amount.trim()) {
    const n = Number(body.amount.replace(/[,₹\s]/g, ""));
    if (Number.isFinite(n)) amount = n;
  }
  const skipDup = body.skip_duplicate_check === true;
  try {
    const result = await createCustomerPayment({
      vendorName,
      chequeNo,
      chequeDate,
      amount,
      checkDuplicates: !skipDup,
    });
    if (result.ok) {
      log.info("cheques.create_payment.ok", {
        by: req.user?.email,
        payment_id: result.payment_id,
        payment_number: result.payment_number,
        customer: result.customer_name,
      });
      res.json(result);
    } else {
      log.warn("cheques.create_payment.rejected", { by: req.user?.email, code: result.code, error: result.error });
      res.status(result.code === "api_error" ? 502 : 422).json(result);
    }
  } catch (e) {
    const msg = (e as Error).message;
    log.error("cheques.create_payment.fail", { error: msg });
    res.status(502).json({ ok: false, error: msg });
  }
});

router.get("/customer/:name", requireSession, (req: SessionedRequest, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);
    res.json(customerDetail(asOfFromQuery(req), name));
  } catch (e) {
    const msg = (e as Error).message;
    log.error("cheques.customer.fail", { error: msg });
    res.status(500).json({ error: `customer detail failed: ${msg}` });
  }
});

export default router;
