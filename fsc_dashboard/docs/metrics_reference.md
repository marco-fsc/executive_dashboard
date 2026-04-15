# FSC Metrics Reference

**Authoritative definitions for all metrics used across the FSC Dashboard and executive reports.**

Data source: HMIS / ServicePoint SUP2 export  
Unit of analysis: `Unique Identifier` (anonymized 8-character client ID)

---

## Table of Contents

1. [Core Client Counts](#1-core-client-counts)
2. [Positive Housing Outcomes (Primary Metric)](#2-positive-housing-outcomes-primary-metric)
3. [Exit Outcomes by Destination Type](#3-exit-outcomes-by-destination-type)
4. [Length of Stay](#4-length-of-stay)
5. [Case Manager Metrics](#5-case-manager-metrics)
6. [Risk Scoring](#6-risk-scoring)
7. [Service Engagement Metrics](#7-service-engagement-metrics)
8. [Program-Level Metrics](#8-program-level-metrics)

---

## 1. Core Client Counts

### Total Active Clients
- **Definition:** Count of rows where `Active in Project == "Yes"`
- **Note:** A client enrolled in multiple programs appears once per program. Org-wide totals may double-count multi-program enrollments.
- **Source column:** `Active in Project`

### Clients Served (Distinct)
- **Definition:** `COUNT(DISTINCT Unique Identifier)` across all enrollments
- **Purpose:** Eliminates double-counting for clients in multiple programs
- **Source column:** `Unique Identifier`

### Total Intakes
- **Definition:** Count of rows with a populated `Project Start Date`
- **Interpretation:** One intake per program enrollment; a client transferring programs generates two intakes

### Total Exits
- **Definition:** Count of rows where `Project Exit Date` is populated
- **Source column:** `Project Exit Date`

---

## 2. Positive Housing Outcomes (Primary Metric)

> **This is the headline metric for FSC.** It answers: *How many unique clients did we connect to stable or improved housing?*

### Definition

A **positive housing outcome** is an exit recorded in any of the following destination categories:

| Destination Category | Counted as Positive | Notes |
|---|---|---|
| **Permanent Housing Situations** | ✅ Yes — all | Rental, owned housing, subsidized housing, living with family/friends permanently |
| **Temporary Housing Situations** | ✅ Yes — all | Staying with family/friends temporarily, transitional programs |
| **Institutional Situations** | ✅ Yes — *with exclusions below* | Foster care, long-term care, substance abuse treatment, psychiatric facility, inpatient rehab |
| Homeless Situations | ❌ No | Emergency shelter, place not meant for habitation, unsheltered |
| Other / Unknown | ❌ No | No exit interview, deceased, unknown |

#### Institutional Exclusions (NOT counted as positive)
Any Institutional Situations exit where `Destination` contains (case-insensitive):
- `"jail"` or `"prison"` — incarceration is not a positive housing outcome
- `"hospital"` — acute medical admission is not a housing placement

Examples **counted**: Long-term care facility, substance abuse residential treatment, foster care, psychiatric residential treatment, inpatient rehabilitation.  
Examples **excluded**: County jail, state prison, hospital (medical).

### Computation

```
Positive Outcomes =
  COUNT(DISTINCT Unique Identifier)
  WHERE Destination Category IN (
    'Permanent Housing Situations',
    'Temporary Housing Situations',
    'Institutional Situations' [excluding jail/prison/hospital]
  )
  AND Project Exit Date IS NOT NULL
  [AND Project Exit Date BETWEEN start_date AND end_date]
```

### Sub-metrics

| Metric | Definition |
|---|---|
| **Permanent Housing Exits** | `COUNT(DISTINCT Unique Identifier)` where `Destination Category = 'Permanent Housing Situations'` |
| **Temporary Housing Exits** | `COUNT(DISTINCT Unique Identifier)` where `Destination Category = 'Temporary Housing Situations'` |
| **Institutional Exits (Positive)** | `COUNT(DISTINCT Unique Identifier)` where `Destination Category = 'Institutional Situations'` AND Destination does NOT match jail/prison/hospital |
| **Total Positive Outcomes** | Distinct clients reaching any of the above three — note: a client exiting to multiple programs may appear in each program's count but is counted once in the org-wide total |

### Positive Outcome Rate

```
Positive Outcome Rate = Total Positive Outcomes / Total Exited Clients × 100
```

Benchmark guidance: **≥ 30% permanent housing exit rate** is the program target (from webapp_manifest.md).

---

## 3. Exit Outcomes by Destination Type

All exit outcomes come from the `Destination Category` column (bucketed by HMIS on export).

| Category | Interpretation |
|---|---|
| **Permanent Housing Situations** | Strong positive — stable long-term housing secured |
| **Temporary Housing Situations** | Positive — short-term stability; client may return |
| **Institutional Situations** | Mixed — positive if not jail/prison/hospital |
| **Homeless Situations** | Negative — returned to homelessness |
| **Other** | Neutral / incomplete — often "No exit interview completed" |

### Homeless Exit Rate

```
Homeless Exit Rate = Homeless Situation Exits / Total Exits × 100
```

Alert threshold: **> 40% homeless exit rate** triggers program review flag.

---

## 4. Length of Stay

### Definition
`Days in Project` — integer, pre-calculated in the HMIS export as:
```
Days in Project = (Project Exit Date OR today) − Project Start Date
```

### Bins Used in Dashboard

| Label | Range |
|---|---|
| 0–14 days | Very short stay |
| 15–30 days | Short stay |
| 31–60 days | Standard stay |
| 61–90 days | Extended stay |
| 91–180 days | Long stay |
| 181–365 days | Very long stay |
| 365+ days | Chronic / systemic barrier |

### Average Length of Stay (ALoS)
```
ALoS = MEAN(Days in Project) for active clients only
```

### Long-Stay Flag
Active clients with `Days in Project ≥ 90`.

### Approaching 60-Day Threshold
Active clients with `Days in Project BETWEEN 45 AND 75`.

---

## 5. Case Manager Metrics

Each row has one `Assigned Staff` (case manager). Metrics are computed per CM.

| Metric | Definition |
|---|---|
| **Active Caseload** | Count of active clients assigned to this CM |
| **Total Exits** | Count of exits from this CM's caseload |
| **Permanent Housing Exits** | Exits to Permanent Housing Situations |
| **Homeless Exits** | Exits to Homeless Situations |
| **Services Logged** | Sum of `Count` (total services in the 3-month window) for active clients |
| **Clients with Zero Services** | Active clients where `Count == 0` |
| **No Recent Contact** | Active clients where `Days Since Last Service > 21` or null |
| **High-Risk Active Clients** | Active clients with Risk Level = "High" |

### CM Load Alert

```
CM Load = Active Caseload / Number of Active CMs per Program
```

Alert threshold: **CM load > 25:1** (from webapp_manifest.md).

---

## 6. Risk Scoring

Each client receives a **Risk Score (0–8)** computed from 8 binary flags. One point per flag present:

| Flag | Condition |
|---|---|
| Mental Health | `Mental Health == "Yes"` |
| Substance Use | `Substance Use Disorder` ∈ {Drug use disorder, Alcohol use disorder, Both} |
| Chronic Health | `Chronic Health == "Yes"` |
| Developmental | `Developmental == "Yes"` |
| Poor Health | `General Health Status == "Poor"` |
| No Services | `Count == 0` (no services logged) |
| No Recent Contact | `Days Since Last Service > 21` OR null |
| Long Stay | `Days in Project ≥ 60` AND client is active |

### Risk Level Thresholds

| Level | Score Range | Interpretation |
|---|---|---|
| **Low** | 0–1 | Stable; monitor regularly |
| **Medium** | 2–3 | Some concerns; check in proactively |
| **High** | 4+ | Immediate attention indicated |

> **Note:** `Days Since Last Service` is derived from `Last Start Date`, which only covers the most recent 3-month service window. A null value means either no service was ever logged in the HMIS *or* the last service was more than 3 months ago — both are treated as "no recent contact."

---

## 7. Service Engagement Metrics

### Services Logged (`Count`)
- Total services recorded for the client in the current report period (past ~3 months)
- A value of 0 means no services were logged in this window, regardless of program enrollment duration

### Days Since Last Service
```
Days Since Last Service = Today − Last Start Date
```
`Last Start Date` is null if no service was logged in the 3-month window.

### No Recent Contact Flag
Applied when: `Days Since Last Service > 21` OR `Last Start Date IS NULL`

---

## 8. Program-Level Metrics

The dashboard includes 6 programs. All patient-level metrics can be filtered and aggregated at the program level.

### Program Summary Row

| Metric | Definition |
|---|---|
| **Active** | Count of active enrollments |
| **Exits** | Count of completed exits |
| **Perm. Exits** | Count of permanent housing exits |
| **Perm. %** | `Perm. Exits / Total Exits × 100` |
| **Homeless Exits** | Count of homeless situation exits |
| **Zero Services** | Active clients with Count = 0 |
| **Avg. LOS** | Mean `Days in Project` for active clients |
| **CMs** | Distinct active `Assigned Staff` count |
| **Avg. CM Load** | Active / CMs |

---

## Data Freshness

The dashboard caches the most recently modified CSV in `FSC_Code/ISP/`.  
Upload a new export at `/upload/` or replace the file in the `ISP/` folder to refresh.  
The `generate_report.py` script picks up the same file automatically.

*Last schema verified: April 2026 against ServicePoint SUP2 report format.*
