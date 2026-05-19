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
  corsOrigin: withDefault("CORS_ORIGIN", "*"),
  zoho: {
    clientId: required("ZOHO_BOOKS_CLIENT_ID"),
    clientSecret: required("ZOHO_BOOKS_CLIENT_SECRET"),
    refreshToken: required("ZOHO_BOOKS_REFRESH_TOKEN"),
    apiDomain: withDefault("ZOHO_BOOKS_API_DOMAIN", "https://www.zohoapis.in").replace(/\/$/, ""),
    tokenUrl: "https://accounts.zoho.in/oauth/v2/token",
    organizationId: withDefault("ZOHO_BOOKS_ORGANIZATION_ID", "60041510057"),
    uncategorizedAccountId: withDefault("ZOHO_BOOKS_UNCATEGORIZED_ACCOUNT_ID", "2524339000000080247"),
    suspenseAccountId: withDefault("ZOHO_BOOKS_SUSPENSE_ACCOUNT_ID", "2524339000005505221"),
    miscDebtorAccountId: withDefault("ZOHO_BOOKS_MISC_DEBTOR_ACCOUNT_ID", "2524339000009724453"),
  },
} as const;
