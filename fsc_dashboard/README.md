# FSC Dashboard — First Step Communities

**Executive housing outcomes dashboard for shelter and transitional housing programs.**  
Built on Django + pandas, powered by HMIS / ServicePoint SUP2 exports.

---

## Quick Start

### Generate the Printable Executive Report
```bash
# All-time data → fsc_report.pdf (opens in any PDF viewer or prints on 8.5×11)
python generate_report.py

# Specific date range
python generate_report.py --start-date 2025-01-01 --end-date 2025-12-31

# Custom output path or PNG format
python generate_report.py --output reports/q1_2026.pdf
python generate_report.py --output report.png --format png

# Point directly at your CSV export
python generate_report.py --csv-path "path/to/export.csv"
```

### Run the Web Application
```bash
python manage.py runserver
```
Visit **http://127.0.0.1:8000** — no login required in development mode.

**Download the report from the browser:**  
`http://127.0.0.1:8000/report/` — accepts optional `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

---

## Setup

### 1. Install dependencies
```bash
pip install django pandas matplotlib pillow openpyxl reportlab
```

### 2. Place your HMIS data export
Drop the SUP2 CSV export into the `ISP/` folder one level above this project:
```
FSC_Code/
├── ISP/
│   └── sac_connection_model client_model 2026-04-06T1721.csv  ← here
└── fsc_dashboard/
    └── manage.py  ← you are here
```
The loader auto-discovers the most recently modified CSV in that folder.  
Alternatively, pass `--csv-path <file>` to `generate_report.py` to use any path directly.

### 3. (First-time Django setup)
```bash
python manage.py migrate
python manage.py runserver
```

---

## Project Structure

```
fsc_dashboard/
├── generate_report.py        ← standalone printable report (entry point)
├── manage.py                 ← Django entry point
├── fsc_logo.avif             ← brand logo used in report header
│
├── core/
│   ├── loader.py             ← CSV ingestion, cleaning, caching
│   ├── services.py           ← all metric computations (pandas)
│   ├── report_engine.py      ← matplotlib figure builder (shared by CLI + web)
│   ├── views.py              ← Django request handlers
│   ├── urls.py               ← URL routing
│   ├── export.py             ← Excel / PDF exports (existing)
│   └── templates/core/
│       ├── base.html
│       ├── executive_dashboard.html
│       ├── supervisor_dashboard.html
│       ├── client_list.html
│       └── upload.html
│
├── docs/
│   ├── metrics.md            ← original metric notes
│   └── metrics_reference.md  ← formal metric definitions (authoritative)
│
└── fsc_dashboard/
    ├── settings.py
    └── urls.py
```

---

## Web Views

| URL | Description |
|-----|-------------|
| `/` | **Executive Dashboard** — KPI cards, destination breakdown chart, length-of-stay histogram, active-by-program chart, program summary table |
| `/supervisor/` | **Supervisor Dashboard** — per-case-manager performance metrics; filterable by program |
| `/clients/` | **Client List** — detailed filterable table with risk flags, health status, and service history |
| `/report/` | **Printable Report (PDF download)** — 8.5×11 executive report of positive housing outcomes |
| `/export/` | Excel / PDF data exports |
| `/upload/` | Upload a new HMIS CSV export (invalidates the data cache automatically) |

---

## Positive Outcomes Definition

The report's headline metric counts **distinct clients** exiting to any of these destination categories:

| Category | Counted |
|----------|---------|
| Permanent Housing Situations | ✅ All |
| Temporary Housing Situations | ✅ All |
| Institutional Situations | ✅ Except jail/prison and hospital (medical) |
| Homeless Situations | ❌ Not counted |
| Other / Unknown | ❌ Not counted |

Uniqueness is determined by **`Unique Identifier`** within each program.  
See [docs/metrics_reference.md](docs/metrics_reference.md) for full metric definitions.

---

## Data Source

HMIS data is exported from **ServicePoint** using the **SUP2 custom report** and saved as a CSV.  
The expected filename pattern is `sac_connection_model client_model <timestamp>.csv`.  
The data includes fields for enrollment dates, exits, destinations, disability flags, services logged,
and anonymized client identifiers.

Current snapshot: **~722 rows · 6 programs · ~518 active clients · 38 case managers**

---

## Report Colors

| Element | Color |
|---------|-------|
| Header background | Forest Green `#228B22` |
| KPI card background | Easter Egg Yellow `#F9E44B` |
| Permanent housing bars | Deep Forest Green `#228B22` |
| Temporary housing bars | Medium Green `#52BE80` |
| Institutional (pos.) bars | Light Green `#A9DFBF` |
| Top-ranked program highlight | Easter Egg Yellow `#F9E44B` |

---

## License

Internal use — First Step Communities.
