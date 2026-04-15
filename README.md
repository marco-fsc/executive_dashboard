# FSC Dashboard — First Step Communities

**Executive housing outcomes dashboard for shelter and transitional housing programs.**
Built with Next.js, deployed on Vercel, authenticated via Microsoft Entra ID.

Live: <https://www.dashboard.firststepcommunities.org>

---

## Quick Start

```bash
cd dashboard
npm install
npm run dev
```

Visit **http://localhost:3000**. In development mode sign-in is not required.

---

## Project Structure

```
dashboard/                    ← Vercel root directory
├── scripts/
│   └── push-dataset.ts       ← CLI: ingest CSV → Vercel Blob
├── src/
│   ├── auth.ts               ← NextAuth config (Entra ID provider)
│   ├── middleware.ts          ← Edge middleware (route protection)
│   ├── app/
│   │   ├── page.tsx           ← Home (redirects to /dashboard)
│   │   ├── dashboard/         ← Executive dashboard
│   │   ├── supervisor/        ← Supervisor dashboard
│   │   ├── clients/           ← Client list
│   │   ├── upload/            ← CSV upload form
│   │   ├── unauthorized/      ← Auth error page
│   │   ├── api/auth/          ← NextAuth route handlers
│   │   ├── api/data/          ← Dataset metadata endpoint
│   │   ├── api/export/        ← Excel / PDF exports
│   │   ├── _actions/          ← Server actions (ingest, data load)
│   │   └── _components/       ← Shared components (TopNav, charts)
│   └── lib/
│       ├── dataset.ts         ← TypeScript types
│       ├── ingest.ts          ← CSV parsing & metric computation
│       └── metrics.ts         ← Metric definitions & constants
├── public/                    ← Static assets (logo)
├── next.config.mjs
├── package.json
└── tsconfig.json

docs/                          ← Reference documents & legacy scripts
```

---

## Web Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | **Executive Dashboard** — KPI cards, destination chart, length-of-stay histogram, program summary |
| `/supervisor` | **Supervisor Dashboard** — per-case-manager performance metrics, filterable by program |
| `/clients` | **Client List** — filterable table with risk flags, health status, service history |
| `/upload` | Upload a new HMIS CSV export (processes and stores in Vercel Blob) |
| `/api/export` | Excel / PDF data exports |

---

## Data Ingestion

HMIS data is exported from **ServicePoint** (SUP2 custom report) as CSV.

### Option A — Upload via browser

Sign in and visit `/upload`. The CSV is processed server-side and stored in Vercel Blob.

### Option B — Push from local machine

```bash
cd dashboard
npx tsx scripts/push-dataset.ts "../path/to/export.csv"
```

Requires `BLOB_READ_WRITE_TOKEN` and `INGEST_SALT` in `dashboard/.env.local`.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | NextAuth encryption secret (`openssl rand -base64 32`) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Entra **Application (client) ID** |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Entra client secret value |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<TENANT_ID>/v2.0` |
| `EXEC_ALLOWED_EMAILS` | Comma-separated allow list. Use `@domain.org` for domain-wide access |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token |
| `INGEST_SALT` | Random salt for anonymised identifiers |

Set these in **Vercel → Project Settings → Environment Variables** for production,
and in `dashboard/.env.local` for local development.

---

## Deployment (Vercel)

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `dashboard` |
| Build Command | `npm run build` |
| Output Directory | *(default)* |

Pushes to `main` trigger automatic deployments.

### Entra Redirect URIs

Register these in the Azure App Registration:

- `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- `https://www.dashboard.firststepcommunities.org/api/auth/callback/microsoft-entra-id`

---

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Auth.js / next-auth** 5 beta — Microsoft Entra ID provider
- **Vercel Blob** — dataset storage
- **PapaParse** — CSV parsing
- **ExcelJS** — spreadsheet export
- **pdf-lib** — PDF report generation

---

## License

Internal use — First Step Communities.
