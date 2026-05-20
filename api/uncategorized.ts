import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireModule } from "./_shared/permissions";
import { fetchAllUncategorized, getAccessToken } from "./_shared/zoho";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireModule(req, res, "suspense")) return;
  try {
    const token = await getAccessToken();
    const rows = await fetchAllUncategorized(token);
    res.status(200).json({ rows });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
