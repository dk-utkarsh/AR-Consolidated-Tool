import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_shared/auth";
import { clearCache } from "./_shared/cache";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  clearCache();
  res.status(200).json({ ok: true });
}
