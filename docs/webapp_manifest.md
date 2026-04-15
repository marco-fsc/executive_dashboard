# FSC Shelter Performance Web App — Manifest

**Data source:** SUP2 custom HMIS report (CSV export)
`sac_connection_model client_model [date].csv`
**Current snapshot:** 722 rows · 22 columns · 6 programs · 518 active clients · 38 case managers

---

## Source Data — Column Reference

| Column | Type | Notes |
|---|---|---|
| `Assigned Staff` | string | Case manager name |
| `Assigned Staff Home Agency` | string | Always "First Step Communities (FSC)" in this dataset |
| `Name` | string | Program name — primary grouping key |
| `Active in Project` | Yes / No | Current enrollment status |
| `Project Start Date` | date | Enrollment date — use for length-of-stay |
| `Project Exit Date` | date | Null if active |
| `Days in Project` | integer | Calculated by HMIS; use directly |
| `Destination` | string | Full destination text on exit |
| `Destination Category` | string | Bucketed exit type (see below) |
| `Unique Identifier` | string | Anonymised client ID |
| `Count` | integer | Total services logged in report period |
| `Last Attendance Date` | date | 62 nulls = never received a logged service |
| `Mental Health` | Yes / No / null | Null = not screened / not exited client |
| `Chronic Health` | Yes / No / null | Includes chronic physical conditions |
| `Survivor of Domestic Violence` | Yes / No / null | |
| `Income from any Source` | "Income" / "No Income" / null | |
| `Total Cash Income` | currency string | "$X,XXX.XX" — needs cleaning |
| `Medicaid` | Yes / No / null | |
| `Medicare` | Yes / No / null | |
| `Employment Seeking` | — | **Empty in all rows — do not use** |
| `Employment Tenure` | — | Sparse; not reliable |
| `Hours Worked Last Week` | integer | Sparse |

**Destination Category values (exits only):**
- `Permanent Housing Situations` ← the primary success metric
- `Temporary Housing Situations`
- `Homeless Situations` ← negative outcome
- `Institutional Situations`
- `Other`
- *(null)* — active clients or unknown

**Note:** No substance use / drug use field is present in this report. Mental Health and Chronic Health are the available risk flags. If a substance use flag is needed, it must be added to the custom HMIS report.

---

## Programs in Dataset

| Program | Type | Active Clients |
|---|---|---|
| DHSH-FSC: Stockton Blvd. Safe Stay - ES | Emergency Shelter | ~195 |
| FSC: CAN Team Outreach - SO | Street Outreach | ~130 |
| FSC: Roseville Road South Campus - ES | Emergency Shelter | ~100 |
| DHSH-FSC: North A Street Campus - ES | Emergency Shelter | ~88 |
| CITY-FSC: Emergency Bridge Housing at The Grove - ES | Emergency Shelter | ~?? |
| CITY-FSC: Emergency Bridge Housing at The Grove - RRH | Rapid Rehousing | ~14 |

---

## View 1 — CEO / Executive Dashboard

**Audience:** Executive director, operations leadership
**Purpose:** At-a-glance shelter health. Is the system moving people to permanent housing? Are clients staying too long? Is capacity being used well?

### KPIs

| KPI | Calculation | Source Columns | Target/Threshold |
|---|---|---|---|
| **Exits to Permanent Housing (%)** | Permanent Housing exits / total exits | `Destination Category` | Goal: >30% |
| **Exits to Homelessness (%)** | Homeless Situations exits / total exits | `Destination Category` | Alert: >40% |
| **Average Length of Stay** | Mean `Days in Project` for active clients | `Days in Project` | Context-dependent by program type |
| **Long-Stay Rate** | Active clients with `Days in Project >= 90` / total active | `Days in Project`, `Active in Project` | Alert: >50% |
| **Active Enrollment Count** | Count of `Active in Project == Yes` | `Active in Project` | Capacity context |
| **Clients with Zero Services** | Active clients with `Count == 0` | `Count`, `Active in Project` | Alert: any |
| **Total Services Logged (period)** | Sum of `Count` | `Count` | Trend over time |
| **Income at Exit Rate** | Exits where `Income from any Source == "Income"` / total exits with data | `Income from any Source`, `Active in Project` | Goal: increase |
| **Case Manager Load (mean)** | Active clients / unique CMs per program | `Assigned Staff`, `Active in Project` | Alert: >25:1 |

### Charts
- Destination category donut chart (exits breakdown)
- Length of stay histogram (active clients)
- Program-by-program bar: exits to permanent housing vs. other
- Services logged trend (requires multiple CSV snapshots over time)
- CM load bar chart by program

---

## View 2 — Case Manager Supervisor Dashboard

**Audience:** Program directors, CM supervisors
**Purpose:** How is each CM performing? Which clients need immediate attention?

### Team Performance Panel (per program, per CM)

| Metric | Calculation | Source Columns |
|---|---|---|
| **Active caseload** | Count of active clients per CM | `Assigned Staff`, `Active in Project` |
| **Exits this period** | Count of `Active in Project == No` per CM | `Assigned Staff`, `Active in Project` |
| **Exits by type** | Breakdown of `Destination Category` per CM | `Assigned Staff`, `Destination Category` |
| **Services logged per client** | Mean `Count` across active caseload | `Count`, `Assigned Staff` |
| **Clients with no services** | Count of `Count == 0` per CM | `Count`, `Assigned Staff` |
| **Clients >30 days no contact** | Count where `(today - Last Attendance Date) > 30` AND active | `Last Attendance Date`, `Active in Project` |

### High-Risk Client Flags

A client should be surfaced as high-risk if they meet **2 or more** of the following:

| Flag | Condition | Source Column |
|---|---|---|
| Mental health need | `Mental Health == "Yes"` | `Mental Health` |
| Chronic health need | `Chronic Health == "Yes"` | `Chronic Health` |
| DV survivor | `Survivor of Domestic Violence == "Yes"` | `Survivor of Domestic Violence` |
| No income | `Income from any Source == "No Income"` | `Income from any Source` |
| No services logged | `Count == 0` | `Count` |
| No recent contact | `(today - Last Attendance Date) > 21 days` AND active | `Last Attendance Date` |
| Long stay | `Days in Project >= 60` AND active | `Days in Project` |
| Approaching 60 days | `Days in Project` between 45 and 60 AND active | `Days in Project` |

### Granular Client Table (filterable)

Columns to show:
- Client ID (`Unique Identifier`)
- CM name
- Program
- Days in project
- Days since last service (calculated)
- Services logged
- Risk flags (badge per flag: Mental Health, Chronic, DV, No Income, No Services)
- Exit date / destination (if exited)

Filters: program, CM, active/exited, risk flag(s), days in program range

---

## View 3 — Low-Level Report (Printable / Exportable)

**Audience:** CMs and supervisors for weekly/monthly review meetings

### Report Types

| Report | Contents |
|---|---|
| **Program Summary** | All KPIs from View 1 for a selected program |
| **CM Caseload Report** | All active clients for a selected CM, with risk flags and service history |
| **High-Risk Client List** | All clients meeting 2+ risk flags, grouped by program |
| **Approaching 60 Days** | Active clients with `Days in Project` between 45 and 75 |
| **No Services Report** | Active clients with `Count == 0` or `Last Attendance Date` > 21 days ago |
| **Exits Report** | All exited clients in period, grouped by destination category |

### Export Formats
- **PDF** — formatted report per program (WeasyPrint recommended over matplotlib)
- **Excel** — raw tabular data for further analysis (openpyxl / pandas)
- **CSV** — flat download of any filtered view

---

## Django App — Proposed Structure

```
fsc_dashboard/
    manage.py
    fsc_dashboard/
        settings.py
        urls.py
    core/
        views.py          # executive dashboard, program detail, cm detail
        urls.py
        services.py       # all pandas logic lives here, not in views
        risk.py           # risk flag scoring logic
        export.py         # PDF + Excel export
        templates/
            base.html
            dashboard.html
            program.html
            cm_detail.html
            client_list.html
            report_export.html
    data/
        loader.py         # CSV ingestion, caching, date handling
```

**Key design decisions:**
- CSV is the source of truth — no database required initially
- Load and cache the CSV in memory on startup (or on file change)
- All aggregations done in `services.py` via pandas; views stay thin
- Chart data served as JSON via simple API endpoints; rendered with Chart.js
- Export via WeasyPrint (PDF) and openpyxl (Excel)
- No authentication required initially (internal tool), but Django's built-in auth can be added trivially

---

## Implementation Status

| Component | File | Status |
|---|---|---|
| Data loader + risk engine | `core/loader.py` | ✅ Built |
| Aggregation services | `core/services.py` | ✅ Built |
| Views | `core/views.py` | ✅ Built |
| Export (Excel + PDF) | `core/export.py` | ✅ Built |
| URL routing | `core/urls.py` | ✅ Built |
| Base template (Bootstrap 5 + Chart.js) | `core/templates/core/base.html` | ✅ Built |
| CEO Dashboard | `core/templates/core/executive_dashboard.html` | ✅ Built |
| Supervisor Dashboard | `core/templates/core/supervisor_dashboard.html` | ✅ Built |
| Client List (filterable) | `core/templates/core/client_list.html` | ✅ Built |
| CSV Upload | `core/templates/core/upload.html` | ✅ Built |

**To start:** `python fsc_dashboard/manage.py runserver`
**App:** http://127.0.0.1:8000/

---

## Data Gaps / Risks

| Gap | Impact | Mitigation |
|---|---|---|
| No substance use field | Cannot flag substance use risk | Add field to custom HMIS report, or use Chronic Health as proxy |
| `Employment Seeking` entirely blank | Cannot track employment goals | Remove from UI; re-evaluate when populated |
| Risk flags (Mental Health, DV, etc.) only populated for exited clients | Limits risk flagging for active clients | Confirm with HMIS admin whether intake assessment always populates these |
| No "last service type" column | Cannot distinguish service quality | Would require a separate service-detail report |
| Single-period snapshot | Cannot show trends | Implement CSV import with date-stamped snapshots stored locally |
| `Total Cash Income` is a formatted string | Needs cleaning before numeric use | Parse in `loader.py` at ingestion |
