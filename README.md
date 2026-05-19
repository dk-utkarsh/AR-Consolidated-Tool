# Consolidated AR Department App

Single React + Node.js product that unifies three previously-separate RPA tools used by the Accounts Receivable department.

## Modules (tabs)

| Tab | Replaces | Purpose |
|---|---|---|
| **TDS 194Q** | `194QTDSVendorWiseReportBifurcationAndEmailSend/` | Upload a 194Q xlsx, bifurcate per vendor, email each vendor their slice. |
| **Cheques** | `ChequeManagementSystem - Copy/` | Track cheque-in-hand from Zoho Books, FIFO-match against vendor payments, OCR new cheque images, age open balances. |
| **Uncategorized Suspense** | `UncategorizedSuspensePayments-main/` | Surface uncategorized payments / suspense entries from Zoho Books and help categorize them. |

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind + Radix UI
- **Backend (short / API):** Node + TypeScript serverless functions on **Vercel**
- **Backend (long jobs):** Node + TypeScript Express worker on **Render** (email blasts, OCR, scheduled Zoho pulls — Vercel functions cap at ~60s)
- **Database:** _deferred_ — currently in-memory on the worker + JSON/CSV files on Render disk. Postgres (Neon) will be wired in after end-to-end testing.
- **Cache:** in-memory inside each runtime (`api/_shared/cache.ts` on Vercel, module-level Maps on the worker). Redis deferred with the DB.
- **External services:** Zoho Books API, Zoho Mail SMTP, Mistral OCR

## Repository skeleton

```
ConsolidatedProject/
├── apps/
│   └── web/                            React + Vite + TS + Tailwind + Radix
│       └── src/
│           ├── App.tsx                 Radix Tabs: TDS 194Q | Cheques | Suspense
│           ├── modules/
│           │   ├── tds194q/            Ported from Project 1 frontend (JSX → TSX)
│           │   ├── cheques/            NEW — replaces Streamlit dashboard
│           │   └── suspense/           From Project 3
│           ├── lib/
│           │   ├── api.ts              Single HTTP client
│           │   ├── auth.tsx            Shared login (from Project 3)
│           │   └── ui/                 shadcn-style shared components
│           └── main.tsx
│
├── api/                                Vercel Node serverless (TS)
│   ├── auth/                           login.ts, me.ts, refresh.ts
│   ├── zoho/                           customers.ts, ledger.ts, locations.ts, uncategorized.ts
│   ├── tds194q/                        upload.ts, jobs.ts, preview.ts, vendors.ts
│   ├── cheques/                        list.ts, aging.ts, vendor.ts, upload-image.ts
│   └── _shared/                        zoho.ts, db.ts, redis.ts, jwt.ts
│
├── worker/                             Render Node service (long jobs)
│   ├── src/
│   │   ├── server.ts                   Express, receives signed job requests
│   │   ├── jobs/
│   │   │   ├── bifurcate.ts            Project 1 logic in TS (exceljs)
│   │   │   ├── send-emails.ts          nodemailer / Zoho Mail SMTP
│   │   │   ├── ocr-cheque.ts           Mistral OCR via fetch
│   │   │   └── pull-zoho-txns.ts       Scheduled puller (replaces Project 2 cron)
│   │   └── lib/                        Shared zoho.ts, db.ts (mirrors api/_shared)
│   └── Dockerfile
│
├── db/                                 (empty for now — schema lands when DB integration is requested)
│
├── package.json                        Root, npm workspaces: apps/*, api, worker
├── vercel.json                         Builds apps/web + api/
├── render.yaml                         Worker service
├── .env.example                        All required env vars in one place
└── README.md                           This file
```

## Tab handling

The three modules are loaded lazily into a single React shell so the initial bundle stays small:

```tsx
// apps/web/src/App.tsx
import * as Tabs from "@radix-ui/react-tabs";
const TDS      = lazy(() => import("./modules/tds194q"));
const Cheques  = lazy(() => import("./modules/cheques"));
const Suspense = lazy(() => import("./modules/suspense"));

<Tabs.Root defaultValue="suspense">
  <Tabs.List>
    <Tabs.Trigger value="tds">TDS 194Q</Tabs.Trigger>
    <Tabs.Trigger value="cheques">Cheques</Tabs.Trigger>
    <Tabs.Trigger value="suspense">Uncategorized Suspense</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="tds"><Suspense fallback={<Spinner/>}><TDS/></Suspense></Tabs.Content>
  <Tabs.Content value="cheques"><Suspense fallback={<Spinner/>}><Cheques/></Suspense></Tabs.Content>
  <Tabs.Content value="suspense"><Suspense fallback={<Spinner/>}><Suspense_/></Suspense></Tabs.Content>
</Tabs.Root>
```

Each module owns its own routes/pages and its own API namespace. A single `lib/api.ts` HTTP client routes calls to either Vercel (`/api/...`) or the Render worker (`VITE_WORKER_URL`).

## Development phases

| # | Phase | Outcome |
|---|---|---|
| 1 | Skeleton + workspaces | Repo builds; placeholder tabs render |
| 2 | Suspense tab integrated | Zoho login + customer/ledger/uncategorized work end-to-end |
| 3 | DB + Worker scaffolding | Neon + Upstash provisioned, worker `/health` reachable from Vercel |
| 4 | TDS 194Q (Node rewrite) | Excel bifurcation + email blast in TS, job progress streamed |
| 5 | Cheques (Streamlit → React) | KPIs, aging, vendor table, OCR upload, scheduled Zoho pull |
| 6 | Shared shell | Unified header, login, deep-link routing |
| 7 | Cleanup + first deploy | Originals removed, prod live on Vercel + Render |

## Deployment

Two services. Both connect to the same git repo and auto-deploy on push to `main`.

### Vercel (web + short API)

What it serves: `apps/web` (React build) + `api/*.ts` (Vercel serverless functions for the Suspense module + login).

1. Import the repo in the Vercel dashboard. It will pick up `vercel.json`.
2. Set environment variables in **Project Settings → Environment Variables**:
   - `SESSION_SECRET` (32+ random chars; or leave blank and rely on auto-derivation from `ZOHO_BOOKS_REFRESH_TOKEN`)
   - `DASHBOARD_USERS`, `DASHBOARD_PASSWORD` (or `USER_1=email:pw`, `USER_2=…`)
   - `DASHBOARD_MATCH_USERS` (subset allowed to mutate uncategorized txns)
   - `ZOHO_BOOKS_CLIENT_ID`, `ZOHO_BOOKS_CLIENT_SECRET`, `ZOHO_BOOKS_REFRESH_TOKEN`
   - `ZOHO_BOOKS_API_DOMAIN` (default `https://www.zohoapis.in`)
   - `ZOHO_BOOKS_ORGANIZATION_ID` + the three account-ID vars (see `.env.example`)
   - `VITE_WORKER_URL` — the public URL of the Render worker (set after the worker deploys). **Must be prefixed `VITE_` to be available in the frontend bundle.**
3. Trigger a deploy. The frontend talks to the worker via `VITE_WORKER_URL` for TDS/Cheques, and to its own `/api/*` for Suspense/login.

### Render (long-job worker)

What it runs: `worker/` Node service for TDS email blasts, Cheque OCR (when Phase 5b lands), and scheduled Zoho pulls.

1. In Render, **New → Blueprint** and point at the repo. It picks up `render.yaml`.
2. Set the env vars marked `sync: false` in `render.yaml` (Zoho creds, Mistral API key, Zoho Mail SMTP creds, `WORKER_SHARED_SECRET`, `SESSION_SECRET`).
3. **`SESSION_SECRET` must match what's set on Vercel** — the worker verifies tokens that Vercel's `/api/login` signs.
4. **`WORKER_SHARED_SECRET` must match `WORKER_SHARED_SECRET` on Vercel** — used only by the HMAC bridge for admin/cron jobs.
5. Add `CORS_ORIGIN` = your Vercel domain (comma-separated for multiple) so the browser can talk directly to the worker.
6. After first deploy, copy the worker's public URL and set it as `VITE_WORKER_URL` on Vercel, then redeploy Vercel.

### Phase-7 cleanup (do this once you've confirmed parity with the originals)

The three legacy Python projects are still on disk for reference:
```
194QTDSVendorWiseReportBifurcationAndEmailSend/
ChequeManagementSystem - Copy/
UncategorizedSuspensePayments-main/
```
Vercel ignores them (`.vercelignore`), so they don't affect the build. Delete them locally only after the new app runs end-to-end against real Zoho data for at least one full TDS month-close cycle and one cheque-management cycle.

## Local development

No Vercel CLI needed for local dev. Three Node processes work together:

| Process | Port | What it does |
|---|---|---|
| **worker** (`worker/`) | 8080 | Long-job Node service. In production this is on Render. |
| **dev-api** (`scripts/dev-api-server.mjs`) | 3001 | Local shim that mimics Vercel functions for `api/*.ts`. **Local-only**, not deployed. |
| **web** (`apps/web/`) | 5173 | Vite dev server. Proxies `/api/*` → dev-api. |

**One-time env setup** — create three files (see `.env.example` for the full list of keys):

1. `./.env` — used by the dev-api shim. Auth + Zoho creds for Suspense + login.
2. `./worker/.env` — used by the worker. Must share `SESSION_SECRET` with the root `.env`. Plus Zoho Mail SMTP for TDS.
3. `./apps/web/.env.local` — frontend bundle. Just one line: `VITE_WORKER_URL=http://127.0.0.1:8080`

**Run everything in one terminal:**

```bash
npm install          # first time only — installs all workspaces
npm run start:local  # starts worker + dev-api + web together
```

Then open <http://localhost:5173>.

Or run them separately if you prefer (three terminals):
```bash
npm run dev:worker   # worker on 8080
npm run dev:api      # dev-api shim on 3001
npm run dev:web      # vite dev server on 5173
```

> Why not `vercel dev`? Vercel's CLI requires a project link + account, and trips on monorepo path slugification. The dev-api shim is ~50 lines and Just Works. Production still deploys api/*.ts to Vercel as real serverless functions — only the local-dev story is different.
