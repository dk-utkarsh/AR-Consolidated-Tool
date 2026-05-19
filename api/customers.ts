import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_shared/auth";
import { fetchCustomers, getAccessToken } from "./_shared/zoho";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  const q = String(req.query.q ?? "");
  try {
    const token = await getAccessToken();
    const customers = await fetchCustomers(token, q);
    res.status(200).json({ customers });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
