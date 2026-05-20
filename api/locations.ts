import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireModule } from "./_shared/permissions";
import { cached } from "./_shared/cache";
import { fetchLocations, getAccessToken } from "./_shared/zoho";

const TTL_MS = 30 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireModule(req, res, "suspense")) return;
  try {
    const locations = await cached("locations", TTL_MS, async () => {
      const token = await getAccessToken();
      return fetchLocations(token);
    });
    res.status(200).json({ locations });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
