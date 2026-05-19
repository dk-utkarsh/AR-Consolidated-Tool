import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_shared/auth";
import { cached } from "./_shared/cache";
import { fetchAllUncategorized, getAccessToken } from "./_shared/zoho";

const TTL_MS = 5 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  try {
    const rows = await cached("uncategorized", TTL_MS, async () => {
      const token = await getAccessToken();
      return fetchAllUncategorized(token);
    });
    res.status(200).json({ rows });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
