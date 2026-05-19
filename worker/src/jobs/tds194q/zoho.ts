import { config } from "../../lib/config";

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface ZohoContact {
  contact_id?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

interface ContactsResponse {
  contacts?: ZohoContact[];
  page_context?: { has_more_page?: boolean };
}

function tokenUrl(): string {
  const tld = config.zoho.apiDomain.replace(/\/$/, "").split(".").pop() ?? "in";
  return `https://accounts.zoho.${tld}/oauth/v2/token`;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const { clientId, clientSecret, refreshToken } = config.zoho;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho creds missing (ZOHO_BOOKS_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN)");
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(tokenUrl(), { method: "POST", body });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(json)}`);
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + 50 * 60_000 };
  return json.access_token;
}

async function fetchAllVendors(token: string): Promise<ZohoContact[]> {
  const orgId = config.zoho.organizationId;
  if (!orgId) throw new Error("ZOHO_BOOKS_ORGANIZATION_ID is not set");

  const all: ZohoContact[] = [];
  let page = 1;
  for (;;) {
    const url =
      `${config.zoho.apiDomain}/books/v3/contacts?` +
      new URLSearchParams({
        organization_id: orgId,
        contact_type: "vendor",
        page: String(page),
        per_page: "200",
      }).toString();
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (!res.ok) throw new Error(`Zoho contacts page ${page} failed: HTTP ${res.status}`);
    const json = (await res.json()) as ContactsResponse;
    all.push(...(json.contacts ?? []));
    if (!json.page_context?.has_more_page) break;
    page += 1;
  }
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface VendorEmailEntry {
  bifurcatedName: string;
  email: string;
  contactId: string;
  contactName: string;
  companyName: string;
  phone: string;
  status: string;
}

export async function buildVendorEmailMap(
  bifurcatedNames: string[],
): Promise<VendorEmailEntry[]> {
  const token = await getAccessToken();
  const vendors = await fetchAllVendors(token);

  const byNorm = new Map<string, ZohoContact>();
  for (const v of vendors) {
    for (const key of ["contact_name", "company_name"] as const) {
      const n = normalize(String(v[key] ?? ""));
      if (n && !byNorm.has(n)) byNorm.set(n, v);
    }
  }

  return bifurcatedNames.map((name) => {
    const v = byNorm.get(normalize(name));
    return {
      bifurcatedName: name,
      email: v?.email ?? "",
      contactId: v?.contact_id ?? "",
      contactName: v?.contact_name ?? "",
      companyName: v?.company_name ?? "",
      phone: v?.phone ?? "",
      status: v?.status ?? "",
    };
  });
}
