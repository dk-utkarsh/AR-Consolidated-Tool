import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_shared/auth";
import { config } from "../_shared/config";
import { cached } from "../_shared/cache";
import { fetchLedger, getAccessToken } from "../_shared/zoho";

const TTL_MS = 5 * 60 * 1000;

const ACCOUNT_ALIASES: Record<string, string> = {
  suspense: config.zoho.suspenseAccountId,
  "misc-debtor": config.zoho.miscDebtorAccountId,
  miscdebtor: config.zoho.miscDebtorAccountId,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const accountParam = String(req.query.account ?? "");
  const accountId = ACCOUNT_ALIASES[accountParam] ?? accountParam;

  const from = String(req.query.from ?? "2000-01-01");
  const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));

  try {
    const rows = await cached(`ledger:${accountId}:${from}:${to}`, TTL_MS, async () => {
      const token = await getAccessToken();
      return fetchLedger(token, accountId, from, to);
    });
    res.status(200).json({ rows });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
