# FSC Dashboard — First Step Communities

**Executive housing outcomes dashboard for shelter and transitional housing programs.**
Built with Next.js, deployed on Vercel, authenticated via Microsoft Entra ID.

Live: <https://www.dashboard.firststepcommunities.org>

---

## Run Dashboard - 3 Tier report in hmis
(Run The Report)[https://sac.clarityhs.com/report/embed/117577/1]

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
| `/report/preview` | **Report Preview** — Clean HTML rendering for PDF conversion (internal) |
| `/api/report/generate` | **Generate PDF Report** — Puppeteer-based PDF generation from preview HTML |

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

## Report Generation

The dashboard includes an enhanced PDF report generator that renders the actual dashboard HTML into professional, print-ready PDFs.

### Features

- **Multi-program reports**: Select multiple programs to generate a single PDF with one page per program
- **Date filtering**: Apply custom date ranges to filter metrics
- **Optional services table**: Include or exclude the services breakdown
- **Professional formatting**: Clean, print-optimized layouts with headers, KPI cards, and program summaries
- **Expanded exit destinations**: Program tables automatically show exit destination breakdowns

### Using the Report Generator

1. Sign in and navigate to the Executive Dashboard (`/dashboard`)
2. Apply any desired filters (program, date range)
3. Click **"Generate Report"** button
4. In the modal:
   - Select one or more programs (or keep "All Programs")
   - Adjust date range if needed
   - Check "Include Services Table" if desired
   - Click "Generate PDF"
5. The PDF will download automatically

### Technical Implementation

The report generator uses:
- **Puppeteer** (`puppeteer-core` + `@sparticuz/chromium`) for headless Chrome rendering
- **Preview page** (`/report/preview`) that renders clean HTML without navigation elements
- **API endpoint** (`/api/report/generate`) that converts the preview HTML to PDF
- **Print-optimized CSS** with page breaks, hidden navigation, and clean borders

**Important:** PDF generation runs entirely **on Vercel's servers** using a headless Chrome browser. Your local browser (Edge, Chrome, etc.) is not involved. The process is:
1. User clicks "Generate PDF" in their browser
2. Request sent to `/api/report/generate` on Vercel
3. Vercel launches headless Chrome, renders the preview page server-side
4. PDF is generated and sent back to the browser as a download
5. No local browser dependencies required

Reports reuse existing metric calculations and component structures, ensuring consistency with the live dashboard.

### Troubleshooting PDF Generation on Vercel

If PDF generation fails with chromium library errors:

1. **Verify function configuration**: Check that `vercel.json` is deployed with memory allocation (3008 MB minimum)
2. **Check logs**: View function logs in Vercel dashboard for detailed error messages
3. **First generation timeout**: Cold starts may take 20-30 seconds; subsequent requests are faster
4. **Memory issues**: If "out of memory" errors occur, increase `memory` value in `vercel.json`
5. **NEXTAUTH_URL**: Ensure this environment variable is set correctly in Vercel (should be your production URL)

The `@sparticuz/chromium` package is optimized for Vercel's serverless environment and includes all necessary system libraries.

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
- **Puppeteer** (`puppeteer-core` + `@sparticuz/chromium`) — HTML-to-PDF conversion
- **pdf-lib** — legacy PDF export (minimal)

---

## License

Internal use — First Step Communities.
