import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireModule } from "../../_shared/permissions";
import { fetchOpenInvoices, getAccessToken } from "../../_shared/zoho";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireModule(req, res, "suspense")) return;
  const customerId = String(req.query.customerId ?? "");
  if (!customerId) {
    res.status(400).json({ error: "customerId is required" });
    return;
  }
  try {
    const token = await getAccessToken();
    const invoices = await fetchOpenInvoices(token, customerId);
    res.status(200).json({ invoices });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
