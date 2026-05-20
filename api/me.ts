import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isMatchUser, requireAuth } from "./_shared/auth";
import { getModulesForUser } from "./_shared/permissions";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const session = requireAuth(req, res);
  if (!session) return;
  res.status(200).json({
    email: session.email,
    canMatch: isMatchUser(session.email),
    modules: getModulesForUser(session.email),
  });
}
