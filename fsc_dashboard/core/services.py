"""
Aggregation service layer.  All pandas logic lives here; views stay thin.
"""

from __future__ import annotations

import pandas as pd

from .loader import load_dataframe


# ── Service defaults ──────────────────────────────────────────────────────────

DEFAULT_SERVICE_ITEMS = [
    "Primary Care Services",
    "Connect to a Primary Health Care Provider",
    "Assist with obtaining Prescribed Medications",
    "General Case Management",
    "Staff Transported",
    "Alcohol & Substance Use Disorder",
    "Provided AOD Services",
    "Linked to a CalAim provider",
    "Provided Bus Pass(es)",
    "Complete / Submit Housing Application(s)",
    "Connect to Mental Health Services",
    "Coordinate Care with Healthcare Providers",
    "Assist with obtaining Health Insurance",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pct(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return round(numerator / denominator * 100, 1)


def _df() -> pd.DataFrame:
    return load_dataframe()


# ── CEO / Executive KPIs ──────────────────────────────────────────────────────

def executive_kpis(program: str | None = None, months: int | None = None) -> dict:
    df = _df()
    if program:
        df = df[df["Name"] == program]

    # Exclude CAN team from housing KPIs — they operate on a different metric
    df = df[~df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)]

    active = df[df["Active in Project"] == "Yes"]
    exited_all = df[df["Active in Project"] == "No"]

    # Exit-based metrics respect the date window; active-state metrics are always current
    if months is not None:
        today = pd.Timestamp.today().normalize()
        window_start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
        exited = exited_all[exited_all["Project Exit Date"] >= window_start]
    else:
        exited = exited_all

    total_active = len(active)
    total_exits = len(exited)

    perm_exits = (exited["Destination Category"] == "Permanent Housing Situations").sum()
    homeless_exits = (exited["Destination Category"] == "Homeless Situations").sum()

    long_stay = (active["Days in Project"] >= 90).sum()
    approaching_60 = active["Days in Project"].between(45, 75).sum()
    zero_services = (active["service_count"].fillna(0) == 0).sum()
    no_recent_contact = (active["Days Since Last Service"].isna() | active["Days Since Last Service"].gt(21)).sum()

    avg_los = round(active["Days in Project"].mean(), 1)

    cm_counts = active.groupby("Assigned Staff")["uid_hash"].count()
    avg_cm_load = round(cm_counts.mean(), 1)
    max_cm_load = int(cm_counts.max())

    return {
        "total_active": int(total_active),
        "total_exits": int(total_exits),
        "perm_housing_exits": int(perm_exits),
        "perm_housing_pct": _pct(perm_exits, total_exits),
        "homeless_exits": int(homeless_exits),
        "homeless_exit_pct": _pct(homeless_exits, total_exits),
        "avg_length_of_stay": avg_los,
        "long_stay_count": int(long_stay),
        "long_stay_pct": _pct(long_stay, total_active),
        "approaching_60_days": int(approaching_60),
        "zero_services_active": int(zero_services),
        "no_recent_contact": int(no_recent_contact),
        "avg_cm_load": avg_cm_load,
        "max_cm_load": max_cm_load,
    }


def can_kpis(months: int | None = None) -> dict:
    """KPIs specific to the CAN Team Outreach program."""
    from .report_engine import _EXCLUDE_PATTERN

    df = _df()
    df = df[df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)]

    active = df[df["Active in Project"] == "Yes"]
    exited_all = df[df["Active in Project"] == "No"]

    if months is not None:
        today = pd.Timestamp.today().normalize()
        window_start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
        exited = exited_all[exited_all["Project Exit Date"] >= window_start]
    else:
        exited = exited_all

    total_exits = len(exited)
    cat = exited["Destination Category"]
    dest = exited["Destination"].fillna("").astype(str)
    institutional_good = (cat == "Institutional Situations") & ~dest.str.contains(_EXCLUDE_PATTERN)
    shelter_dest = dest.str.contains(r"Emergency shelter|Safe Haven", case=False)
    positive_mask = (
        (cat == "Permanent Housing Situations")
        | (cat == "Temporary Housing Situations")
        | institutional_good
        | (cat == "Other")
        | ((cat == "Homeless Situations") & shelter_dest)
    )
    positive = int(positive_mask.sum())
    perm = int((cat == "Permanent Housing Situations").sum())
    shelter_connected = int(((cat == "Homeless Situations") & shelter_dest).sum())

    return {
        "active_navigations": int(len(active)),
        "total_exits": total_exits,
        "positive_exits": positive,
        "positive_pct": _pct(positive, total_exits),
        "perm_housing": perm,
        "shelter_connected": shelter_connected,
    }


def destination_breakdown(program: str | None = None) -> dict:
    """Returns {label: count} for chart.js."""
    df = _df()
    if program:
        df = df[df["Name"] == program]
    exited = df[df["Active in Project"] == "No"]
    counts = (
        exited["Destination Category"]
        .fillna("Unknown")
        .value_counts()
    )
    return dict(zip(counts.index.tolist(), counts.values.tolist()))


def positive_exits_by_program(months: int = 6, program: str | None = None) -> dict:
    """
    Simple bar chart: one bar per program, total positive exits in the date window.
    Returns Chart.js-compatible {labels, data, colors}.
    """
    from .report_engine import _EXCLUDE_PATTERN

    df = _df()
    exited = df[
        df["Project Exit Date"].notna()
        & ~df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)
    ].copy()
    if program:
        exited = exited[exited["Name"] == program]

    today = pd.Timestamp.today().normalize()
    start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
    exited = exited[exited["Project Exit Date"] >= start]

    exited["_positive"] = (
        (exited["Destination Category"] == "Permanent Housing Situations")
        | (exited["Destination Category"] == "Temporary Housing Situations")
        | (
            (exited["Destination Category"] == "Institutional Situations")
            & ~exited["Destination"].fillna("").astype(str).str.contains(_EXCLUDE_PATTERN)
        )
    )
    positive = exited[exited["_positive"]]
    counts = positive.groupby("Name")["uid_hash"].nunique().sort_values(ascending=False)

    all_total = int(counts.sum())
    all_label = "All Programs"
    all_color = "#1e5128"

    labels = [all_label] + [_short_name(n) for n in counts.index.tolist()]
    data = [all_total] + [int(v) for v in counts.values.tolist()]
    colors = [all_color] + [_TREND_COLORS[i % len(_TREND_COLORS)] for i in range(len(counts))]
    return {"labels": labels, "data": data, "colors": colors}


def positive_exits_bar_chart(months: int = 6, program: str | None = None) -> dict:
    """
    Stacked bar chart: positive exits per program, per month.
    Each bar segment = one program; full bar height = combined total that month.
    Returns Chart.js-compatible {labels, datasets, is_forecast}.
    """
    from .report_engine import _EXCLUDE_PATTERN

    df = _df()
    exited = df[
        df["Project Exit Date"].notna()
        & ~df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)
    ].copy()
    if program:
        exited = exited[exited["Name"] == program]

    exited["_positive"] = (
        (exited["Destination Category"] == "Permanent Housing Situations")
        | (exited["Destination Category"] == "Temporary Housing Situations")
        | (
            (exited["Destination Category"] == "Institutional Situations")
            & ~exited["Destination"].fillna("").astype(str).str.contains(_EXCLUDE_PATTERN)
        )
    )
    positive = exited[exited["_positive"]].copy()

    today = pd.Timestamp.today().normalize()
    window_60 = today - pd.Timedelta(days=60)
    start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
    positive = positive[positive["Project Exit Date"] >= start]
    positive["_month"] = positive["Project Exit Date"].dt.to_period("M")

    periods = pd.period_range(start=start, end=today, freq="M")
    labels = [p.strftime("%b %Y") for p in periods]

    is_forecast = bool(len(periods) and periods[-1] == today.to_period("M") and today.day < today.days_in_month)
    days_in_month = today.days_in_month
    if is_forecast:
        labels[-1] = labels[-1] + " ★"

    last_60_pos = exited[exited["_positive"] & (exited["Project Exit Date"] >= window_60)]

    prog_names = sorted(positive["Name"].dropna().unique().tolist())
    datasets = []
    for i, prog in enumerate(prog_names):
        grp = positive[positive["Name"] == prog]
        monthly = grp.groupby("_month")["uid_hash"].nunique()
        data = [int(monthly.get(p, 0)) for p in periods]
        if is_forecast:
            rate = len(last_60_pos[last_60_pos["Name"] == prog]) / 60
            data[-1] = round(rate * days_in_month)
        color = _TREND_COLORS[i % len(_TREND_COLORS)]
        datasets.append({
            "label": _short_name(prog),
            "data": data,
            "backgroundColor": color + "cc",
            "borderColor": color,
            "borderWidth": 1,
            "borderRadius": 3,
        })

    return {"labels": labels, "datasets": datasets, "is_forecast": is_forecast}


def service_counts(
    items: list[str] | None = None,
    months: int | None = None,
    program: str | None = None,
) -> list[dict]:
    """
    Count service events for the given service item names.
    Returns [{name, count}] sorted descending by count.
    """
    from .loader import load_services
    svc = load_services()

    if program:
        svc = svc[svc["Name"] == program]

    if months is not None:
        today = pd.Timestamp.today().normalize()
        window_start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
        svc = svc[svc["Service Attendance Date"] >= window_start]

    if items is None:
        items = DEFAULT_SERVICE_ITEMS

    rows = []
    for name in items:
        count = int(svc[svc["Service Item Name"] == name]["Count"].sum())
        rows.append({"name": name, "count": count})

    rows = sorted(rows, key=lambda r: r["count"], reverse=True)
    max_count = max((r["count"] for r in rows), default=1) or 1
    for r in rows:
        r["pct"] = round(r["count"] / max_count * 100)
    return rows


def program_summary(program: str | None = None, months: int | None = None) -> list[dict]:
    """Per-program KPI rows for the CEO table. If months is given, exits are filtered to that window."""
    df = _df()
    if program:
        df = df[df["Name"] == program]

    # For exit-based metrics, optionally restrict to the date-range window
    if months is not None:
        today = pd.Timestamp.today().normalize()
        window_start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
    else:
        window_start = None

    from .report_engine import _EXCLUDE_PATTERN

    def _positive_mask(exited_df: pd.DataFrame, is_can: bool) -> pd.Series:
        """Boolean mask for positive exits. CAN additionally counts 'Other' and emergency shelter."""
        cat = exited_df["Destination Category"]
        dest = exited_df["Destination"].fillna("").astype(str)
        institutional_good = (cat == "Institutional Situations") & ~dest.str.contains(_EXCLUDE_PATTERN)
        mask = (
            (cat == "Permanent Housing Situations")
            | (cat == "Temporary Housing Situations")
            | institutional_good
        )
        if is_can:
            shelter_dest = dest.str.contains(r"Emergency shelter|Safe Haven", case=False)
            mask = mask | (cat == "Other") | ((cat == "Homeless Situations") & shelter_dest)
        return mask

    rows = []
    for prog_name, group in df.groupby("Name"):
        is_can = pd.Series([prog_name]).str.contains(CAN_IDENTIFIER, case=False).iloc[0]
        active = group[group["Active in Project"] == "Yes"]
        exited_all = group[group["Active in Project"] == "No"]
        if window_start is not None:
            exited = exited_all[exited_all["Project Exit Date"] >= window_start]
        else:
            exited = exited_all
        perm = (exited["Destination Category"] == "Permanent Housing Situations").sum()
        homeless = (exited["Destination Category"] == "Homeless Situations").sum()
        positive = _positive_mask(exited, is_can).sum()
        total_exits = len(exited)
        cms = active["Assigned Staff"].nunique()
        avg_load = round(len(active) / cms, 1) if cms else 0
        rows.append({
            "program": prog_name,
            "active": len(active),
            "exits": total_exits,
            "perm_exits": int(perm),
            "perm_pct": _pct(perm, total_exits),
            "positive_exits": int(positive),
            "positive_pct": _pct(positive, total_exits),
            "homeless_exits": int(homeless),
            "zero_services": int((active["service_count"].fillna(0) == 0).sum()),
            "avg_los": round(active["Days in Project"].mean(), 1) if len(active) else 0,
            "cms": cms,
            "avg_cm_load": avg_load,
        })
    return sorted(rows, key=lambda r: r["active"], reverse=True)


def los_histogram_data(program: str | None = None) -> dict:
    """Bin active client lengths of stay for a histogram."""
    df = _df()
    if program:
        df = df[df["Name"] == program]
    active = df[df["Active in Project"] == "Yes"]
    bins = [0, 14, 30, 60, 90, 180, 365, 9999]
    labels = ["0-14d", "15-30d", "31-60d", "61-90d", "91-180d", "181-365d", "365d+"]
    cut = pd.cut(active["Days in Project"], bins=bins, labels=labels, right=True)
    counts = cut.value_counts().reindex(labels, fill_value=0)
    return {"labels": labels, "data": counts.values.tolist()}


def active_by_program_chart(program: str | None = None) -> dict:
    df = _df()
    if program:
        df = df[df["Name"] == program]
    active = df[df["Active in Project"] == "Yes"]
    counts = active["Name"].value_counts()
    return {"labels": counts.index.tolist(), "data": counts.values.tolist()}


# ── Constants ─────────────────────────────────────────────────────────────────

CAN_IDENTIFIER = "CAN Team Outreach"   # substring match against program Name

_TREND_COLORS = [
    "#228B22", "#52BE80", "#0d6efd", "#6610f2",
    "#fd7e14", "#dc3545", "#0dcaf0", "#A9DFBF",
]


def _short_name(name: str) -> str:
    """Shorten a full program name to a chart-friendly label."""
    import re
    name = re.sub(r"^[A-Z\-]+FSC:\s*|^FSC:\s*", "", name)
    name = name.replace("Emergency Bridge Housing at ", "")
    name = name.replace("Rapid Rehousing Program", "RRH")
    name = name.replace(" - SO", " (Outreach)")
    return name.strip()[:35]


def positive_outcomes_trend(months: int = 6, program: str | None = None) -> dict:
    """
    Monthly positive-outcome counts per housing program over the last N months.
    CAN Team Outreach is excluded (shown separately via can_trend()).
    Current partial month is projected using the 60-day exit rate.
    Returns Chart.js-compatible {labels, datasets, is_forecast}.
    """
    from .report_engine import _EXCLUDE_PATTERN

    df = _df()
    exited = df[
        df["Project Exit Date"].notna()
        & ~df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)
    ].copy()

    if program and not pd.Series([program]).str.contains(CAN_IDENTIFIER, case=False).iloc[0]:
        exited = exited[exited["Name"] == program]

    exited["_positive"] = (
        (exited["Destination Category"] == "Permanent Housing Situations")
        | (exited["Destination Category"] == "Temporary Housing Situations")
        | (
            (exited["Destination Category"] == "Institutional Situations")
            & ~exited["Destination"].fillna("").astype(str).str.contains(_EXCLUDE_PATTERN)
        )
    )

    today = pd.Timestamp.today().normalize()
    start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
    window_60 = today - pd.Timedelta(days=60)

    positive = exited[exited["_positive"]]
    display = positive[positive["Project Exit Date"] >= start].copy()
    display["_month"] = display["Project Exit Date"].dt.to_period("M")

    periods = pd.period_range(start=start, end=today, freq="M")
    labels = [p.strftime("%b %Y") for p in periods]

    is_forecast = bool(len(periods) and periods[-1] == today.to_period("M") and today.day < today.days_in_month)
    days_in_month = today.days_in_month
    if is_forecast:
        labels[-1] = labels[-1] + " ★"

    # 60-day window for rate estimation
    last_60 = positive[positive["Project Exit Date"] >= window_60]

    prog_names = sorted(positive["Name"].dropna().unique().tolist())
    datasets = []

    for i, prog in enumerate(prog_names):
        grp = display[display["Name"] == prog]
        monthly = grp.groupby("_month")["uid_hash"].nunique()
        data = [int(monthly.get(p, 0)) for p in periods]
        if is_forecast:
            rate = len(last_60[last_60["Name"] == prog]) / 60
            data[-1] = round(rate * days_in_month)
        color = _TREND_COLORS[i % len(_TREND_COLORS)]
        datasets.append({
            "label": _short_name(prog),
            "data": data,
            "borderColor": color,
            "backgroundColor": color + "22",
            "tension": 0.35,
            "pointRadius": 4,
            "borderWidth": 1.5,
            "fill": False,
        })

    # All Programs total — computed independently to avoid double-counting
    all_monthly = display.groupby("_month")["uid_hash"].nunique()
    all_data = [int(all_monthly.get(p, 0)) for p in periods]
    if is_forecast:
        all_rate = len(last_60) / 60
        all_data[-1] = round(all_rate * days_in_month)
    datasets.insert(0, {
        "label": "All Programs",
        "data": all_data,
        "borderColor": "#212529",
        "backgroundColor": "#21252933",
        "tension": 0.35,
        "pointRadius": 5,
        "borderWidth": 2.5,
        "fill": False,
    })

    return {"labels": labels, "datasets": datasets, "is_forecast": is_forecast}


def can_trend(months: int = 6) -> dict:
    """
    Monthly navigation counts for the CAN Team Outreach program.
    Metric = distinct clients exited each month (each exit = a successful navigation).
    Returns Chart.js-compatible {labels, datasets, summary}.
    """
    df = _df()
    can = df[
        df["Project Exit Date"].notna()
        & df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)
    ].copy()

    today = pd.Timestamp.today().normalize()
    start = (today - pd.DateOffset(months=months - 1)).replace(day=1)
    window_60 = today - pd.Timedelta(days=60)
    can = can[can["Project Exit Date"] >= start]
    can["_month"] = can["Project Exit Date"].dt.to_period("M")

    periods = pd.period_range(start=start, end=today, freq="M")
    labels = [p.strftime("%b %Y") for p in periods]

    is_forecast = bool(len(periods) and periods[-1] == today.to_period("M") and today.day < today.days_in_month)
    days_in_month = today.days_in_month
    if is_forecast:
        labels[-1] = labels[-1] + " ★"

    monthly = can.groupby("_month")["uid_hash"].nunique()
    data = [int(monthly.get(p, 0)) for p in periods]
    if is_forecast:
        can_60 = df[
            df["Project Exit Date"].notna()
            & df["Name"].str.contains(CAN_IDENTIFIER, case=False, na=False)
            & (df["Project Exit Date"] >= window_60)
        ]
        rate = len(can_60) / 60
        data[-1] = round(rate * days_in_month)

    # Destination breakdown for context
    dest_counts = (
        can["Destination Category"].fillna("Unknown").value_counts().to_dict()
    )

    return {
        "labels": labels,
        "datasets": [{
            "label": "CAN Navigations",
            "data": data,
            "borderColor": "#fd7e14",
            "backgroundColor": "#fd7e1422",
            "tension": 0.35,
            "pointRadius": 4,
            "fill": True,
        }],
        "total_navigations": int(can["uid_hash"].nunique()),
        "dest_breakdown": dest_counts,
        "is_forecast": is_forecast,
    }


def positive_outcomes(
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """
    Return distinct positive housing outcome counts, overall and per program.

    Positive outcomes = Permanent Housing + Temporary Housing +
    Institutional (excluding jail, prison, and hospital destinations).

    Parameters
    ----------
    start_date, end_date : optional ISO date strings (YYYY-MM-DD)
        Restrict to exits on/after start_date and on/before end_date.

    Returns
    -------
    See core.report_engine.compute_positive_outcomes() for the full schema.
    """
    from .report_engine import compute_positive_outcomes
    return compute_positive_outcomes(_df(), start_date=start_date, end_date=end_date)


# ── Supervisor / CM Dashboard ─────────────────────────────────────────────────

def program_list() -> list[str]:
    return sorted(_df()["Name"].dropna().unique().tolist())


def cm_list(program: str | None = None) -> list[str]:
    df = _df()
    if program:
        df = df[df["Name"] == program]
    return sorted(df["Assigned Staff"].dropna().unique().tolist())


def cm_summary(program: str | None = None) -> list[dict]:
    """Per-CM performance metrics."""
    df = _df()
    if program:
        df = df[df["Name"] == program]

    rows = []
    for cm, group in df.groupby("Assigned Staff"):
        active = group[group["Active in Project"] == "Yes"]
        exited = group[group["Active in Project"] == "No"]
        perm = (exited["Destination Category"] == "Permanent Housing Situations").sum()
        homeless = (exited["Destination Category"] == "Homeless Situations").sum()
        high_risk = (active["Risk Level"] == "High").sum()
        no_contact = (active["Days Since Last Service"].isna() | active["Days Since Last Service"].gt(21)).sum()
        zero_svc = (active["service_count"].fillna(0) == 0).sum()
        rows.append({
            "cm": cm,
            "program": group["Name"].iloc[0] if program else "Multiple",
            "active_clients": len(active),
            "total_exits": len(exited),
            "perm_exits": int(perm),
            "homeless_exits": int(homeless),
            "services_logged": int(active["service_count"].fillna(0).sum()),
            "zero_services": int(zero_svc),
            "no_recent_contact": int(no_contact),
            "high_risk_clients": int(high_risk),
        })
    return sorted(rows, key=lambda r: r["active_clients"], reverse=True)


def client_list(
    program: str | None = None,
    cm: str | None = None,
    active_only: bool = True,
    risk_level: str | None = None,
    min_days: int | None = None,
    max_days: int | None = None,
    no_services: bool = False,
    no_recent_contact: bool = False,
    approaching_60: bool = False,
) -> list[dict]:
    """Filtered, sorted client list for the granular view."""
    df = _df()

    if program:
        df = df[df["Name"] == program]
    if cm:
        df = df[df["Assigned Staff"] == cm]
    if active_only:
        df = df[df["Active in Project"] == "Yes"]
    if risk_level:
        df = df[df["Risk Level"] == risk_level]
    if min_days is not None:
        df = df[df["Days in Project"] >= min_days]
    if max_days is not None:
        df = df[df["Days in Project"] <= max_days]
    if no_services:
        df = df[df["service_count"].fillna(0) == 0]
    if no_recent_contact:
        df = df[df["Days Since Last Service"] > 21]
    if approaching_60:
        df = df[df["Days in Project"].between(45, 75)]

    out = []
    for _, row in df.iterrows():
        flags = []
        if row.get("Mental Health") == "Yes":
            flags.append("Mental Health")
        sub = row.get("Substance Use Disorder", "")
        if isinstance(sub, str) and sub not in ("No", "nan", ""):
            flags.append("Substance Use")
        if row.get("Chronic Health") == "Yes":
            flags.append("Chronic Health")
        if row.get("Developmental") == "Yes":
            flags.append("Developmental")
        if row.get("General Health Status") == "Poor":
            flags.append("Poor Health")
        if row.get("service_count", 1) == 0:
            flags.append("No Services")
        days_since = row.get("Days Since Last Service")
        if pd.isna(days_since) or days_since > 21:
            flags.append("No Recent Contact")
        if row.get("Days in Project", 0) >= 60:
            flags.append("Long Stay")

        out.append({
            "uid": row["uid_hash"],
            "cm": row["Assigned Staff"],
            "program": row["Name"],
            "active": row["Active in Project"],
            "days_in_program": int(row["Days in Project"]) if pd.notna(row["Days in Project"]) else None,
            "project_start": row["Project Start Date"].strftime("%Y-%m-%d") if pd.notna(row["Project Start Date"]) else "",
            "days_since_service": int(days_since) if pd.notna(days_since) else None,  # None = no service in 3-month window
            "services_count": int(row["service_count"]) if pd.notna(row.get("service_count")) else 0,
            "risk_level": str(row["Risk Level"]),
            "risk_score": int(row["Risk Score"]),
            "flags": flags,
            "destination": row.get("Destination Category", "") or "",
            "exit_date": row["Project Exit Date"].strftime("%Y-%m-%d") if pd.notna(row.get("Project Exit Date")) else "",
            "cash_income": row.get("Cash Income Amount"),
            "general_health": row.get("General Health Status", ""),
        })

    return sorted(out, key=lambda c: c["risk_score"], reverse=True)
