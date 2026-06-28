import path from "node:path";

function clean(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const trimmed = v.trim().replace(/^['"]|['"]$/g, "").trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function required(name: string): string {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function withDefault(name: string, fallback: string): string {
  return clean(process.env[name]) ?? fallback;
}

export const config = {
  port: Number(withDefault("PORT", "8080")),
  dataDir: path.resolve(withDefault("WORKER_DATA_DIR", "./data")),

  // Compliance tab is served by the Python GST engine (FastAPI). The worker's
  // /compliance/* routes proxy to it. Default is the local dev port; set
  // COMPLIANCE_PY_URL in production to the deployed Python service URL.
  compliancePyUrl: withDefault("COMPLIANCE_PY_URL", "http://127.0.0.1:8091").replace(/\/$/, ""),

  // Vercel -> worker request signing. Must match WORKER_SHARED_SECRET on the API side.
  // Required in production; loose-checked in dev (see auth.ts).
  sharedSecret: clean(process.env.WORKER_SHARED_SECRET),

  // Zoho creds — shared with the api/ side.
  zoho: {
    clientId: clean(process.env.ZOHO_BOOKS_CLIENT_ID),
    clientSecret: clean(process.env.ZOHO_BOOKS_CLIENT_SECRET),
    refreshToken: clean(process.env.ZOHO_BOOKS_REFRESH_TOKEN),
    apiDomain: withDefault("ZOHO_BOOKS_API_DOMAIN", "https://www.zohoapis.in").replace(/\/$/, ""),
    organizationId: clean(process.env.ZOHO_BOOKS_ORGANIZATION_ID),
    chequeInHandAccountId: clean(process.env.ZOHO_BOOKS_CHEQUE_IN_HAND_ACCOUNT_ID),
  },

  // Zoho Mail SMTP — TDS 194Q email blast.
  mail: {
    host: withDefault("ZOHO_MAIL_HOST", "smtp.zoho.in"),
    port: Number(withDefault("ZOHO_MAIL_PORT", "465")),
    user: clean(process.env.ZOHO_MAIL_USER),
    password: clean(process.env.ZOHO_MAIL_PASSWORD),
    from: clean(process.env.ZOHO_MAIL_FROM),
    testRecipient: clean(process.env.TDS_TEST_RECIPIENT),
  },

  mistralApiKey: clean(process.env.MISTRAL_API_KEY),

  env: withDefault("NODE_ENV", "development"),
} as const;

export function assertProductionSecrets(): void {
  if (config.env === "production" && !config.sharedSecret) {
    throw new Error("WORKER_SHARED_SECRET must be set in production");
  }
}
