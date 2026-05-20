import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireMatchUser } from "../../_shared/auth";
import { userCanAccessModule } from "../../_shared/permissions";
import { clearCache } from "../../_shared/cache";
import {
  categorizeAsCustomerPayment,
  getAccessToken,
  type CategorizeAsCustomerPaymentBody,
} from "../../_shared/zoho";

interface IncomingBody {
  customer_id?: unknown;
  amount?: unknown;
  date?: unknown;
  reference_number?: unknown;
  description?: unknown;
  location_id?: unknown;
  payment_mode?: unknown;
  invoices?: unknown;
  /** "payment" (default) or "advance". Advance skips invoice requirements. */
  mode?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const session = requireMatchUser(req, res);
  if (!session) return;
  if (!userCanAccessModule(session.email, "suspense")) {
    res.status(403).json({ error: "You do not have access to the Uncategorized Suspense module" });
    return;
  }

  const txnId = String(req.query.id ?? "");
  if (!txnId) {
    res.status(400).json({ error: "Missing bank transaction id" });
    return;
  }

  const body: IncomingBody =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});

  const customerId = asString(body.customer_id);
  const amount = asNumber(body.amount);
  const date = asString(body.date);
  const paymentMode = asString(body.payment_mode) ?? "banktransfer";
  const referenceNumber = asString(body.reference_number);
  const description = asString(body.description);
  const locationId = asString(body.location_id);
  // Mode: "payment" (default) applies to invoices; "advance" sits as unapplied credit.
  const modeRaw = asString(body.mode);
  const mode: "payment" | "advance" = modeRaw === "advance" ? "advance" : "payment";

  if (!customerId || amount === undefined || !date) {
    res.status(400).json({ error: "customer_id, amount, and date are required" });
    return;
  }

  const rawInvoices = Array.isArray(body.invoices) ? body.invoices : [];
  const invoices: Array<{ invoice_id: string; amount_applied: number }> = [];
  for (const inv of rawInvoices) {
    if (typeof inv !== "object" || inv === null) continue;
    const r = inv as Record<string, unknown>;
    const invoiceId = asString(r.invoice_id);
    const applied = asNumber(r.amount_applied);
    if (!invoiceId || applied === undefined || applied <= 0) continue;
    invoices.push({ invoice_id: invoiceId, amount_applied: applied });
  }

  if (mode === "payment") {
    if (invoices.length === 0) {
      res.status(400).json({ error: "At least one invoice must be selected" });
      return;
    }
    const totalApplied = invoices.reduce((s, i) => s + i.amount_applied, 0);
    if (Math.abs(totalApplied - amount) > 0.01) {
      res.status(400).json({
        error: `Sum of applied amounts (${totalApplied}) does not equal deposit amount (${amount})`,
      });
      return;
    }
  } else {
    // Advance: ignore any invoice rows the client sent; the deposit stays
    // unapplied on the customer's account.
    invoices.length = 0;
  }

  const payload: CategorizeAsCustomerPaymentBody = {
    customer_id: customerId,
    payment_mode: paymentMode,
    amount,
    date,
    invoices,
    ...(referenceNumber ? { reference_number: referenceNumber } : {}),
    ...(description ? { description } : {}),
    ...(locationId ? { location_id: locationId } : {}),
  };

  try {
    const token = await getAccessToken();
    const result = await categorizeAsCustomerPayment(token, txnId, payload);
    clearCache();
    res.status(200).json({ ok: true, result });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
