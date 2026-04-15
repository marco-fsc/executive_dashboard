"""
CSV ingestion and caching layer.

Prefers data/enrollments.csv (output of ingest.py -- one row per client
enrollment, UIDs hashed).  Falls back to the most recently modified raw
service-level CSV and deduplicates it in-memory on first load.

Public API
----------
    load_dataframe()   -- enrollment-level DataFrame (one row per client-program)
    load_services()    -- service-event DataFrame    (one row per service event)
    invalidate_cache() -- clear both caches (call after upload/ingest)
"""

import threading
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent  # fsc_dashboard/
DATA_DIR     = PROJECT_ROOT / "data"
_ISP_DIR     = PROJECT_ROOT.parent / "ISP"

_cache_lock  = threading.Lock()
_cached_df:   pd.DataFrame | None = None
_cached_path: str | None = None

_svc_lock    = threading.Lock()
_cached_svc:  pd.DataFrame | None = None

SUBSTANCE_USE_COLS = [
    "Drug use disorder",
    "Alcohol use disorder",
    "Both alcohol and drug use disorders",
]

_ENROLL_KEY  = ["uid_hash", "Name", "Project Start Date"]
_RAW_SVC_COLS = {
    "Service Attendance Date", "Service Item Name", "Count",
    "Last Start Date", "Last Attendance Date",
    "Total Cash Income", "Total Cash Income.1",
}


# ── Public API ────────────────────────────────────────────────────────────────

def load_dataframe(path: str | Path | None = None) -> pd.DataFrame:
    """
    Return the enrollment-level DataFrame (one row per client-program).

    Priority order:
      1. data/enrollments.csv  (output of ingest.py -- preferred)
      2. Explicit path argument
      3. Raw service-level CSV auto-discovered in data/, project root, or ISP/
         (deduplicated in-memory -- no UID hashing in fallback mode)
    """
    global _cached_df, _cached_path

    if path is None:
        enroll_path = DATA_DIR / "enrollments.csv"
        path = str(enroll_path) if enroll_path.exists() else str(_find_raw_csv())

    path = str(path)

    with _cache_lock:
        if path == _cached_path and _cached_df is not None:
            return _cached_df
        df = _load_and_prepare(path)
        _cached_df   = df
        _cached_path = path
        return df


def load_services() -> pd.DataFrame:
    """Return the service-event DataFrame from data/services.csv."""
    global _cached_svc
    svc_path = DATA_DIR / "services.csv"
    with _svc_lock:
        if _cached_svc is not None:
            return _cached_svc
        if not svc_path.exists():
            return pd.DataFrame(columns=[
                "uid_hash", "Name", "Project Start Date",
                "Service Item Name", "Service Attendance Date", "Count",
            ])
        df = pd.read_csv(svc_path, low_memory=False)
        for col in ("Service Attendance Date", "Project Start Date"):
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
        _cached_svc = df
        return df


def invalidate_cache() -> None:
    """Clear enrollment and service caches (call after ingest or CSV upload)."""
    global _cached_df, _cached_path, _cached_svc
    with _cache_lock:
        _cached_df   = None
        _cached_path = None
    with _svc_lock:
        _cached_svc = None


# ── Private helpers ───────────────────────────────────────────────────────────

def _find_raw_csv() -> Path:
    for search_dir in [DATA_DIR, PROJECT_ROOT, _ISP_DIR]:
        candidates = sorted(
            [p for p in Path(search_dir).glob("*.csv")
             if p.stem not in ("enrollments", "services")],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            return candidates[0]
    raise FileNotFoundError(
        "No CSV found. Run: python ingest.py  or upload via the web UI."
    )


def _parse_cash_income(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.replace(r"[$,]", "", regex=True)
        .pipe(pd.to_numeric, errors="coerce")
    )


def _load_and_prepare(path: str) -> pd.DataFrame:
    """Load a CSV (enrollment or raw service-level) and apply cleaning pipeline."""
    df = pd.read_csv(path, low_memory=False)
    # Drop unnamed index column if present (from pd.read_csv with index_col=0)
    unnamed = [c for c in df.columns if c.startswith("Unnamed")]
    if unnamed:
        df = df.drop(columns=unnamed)

    if "uid_hash" not in df.columns:
        # Raw service-level export -- deduplicate to enrollment level first
        df = _dedup_raw(df)

    return _clean_enrollment(df)


def _dedup_raw(df: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse a service-level CSV into enrollment-level rows.
    Renames 'Unique Identifier' -> 'uid_hash' (no salt hashing in fallback mode
    -- the 8-char HMIS UID is already anonymized).
    Computes last_service_date and service_count per enrollment.
    """
    # Parse dates
    for col in ("Project Start Date", "Project Exit Date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    if "Service Attendance Date" in df.columns:
        df["Service Attendance Date"] = pd.to_datetime(
            df["Service Attendance Date"], errors="coerce"
        )

    # Parse income
    income_col = "Total Cash Income.1" if "Total Cash Income.1" in df.columns else "Total Cash Income"
    if income_col in df.columns:
        df["Cash Income Amount"] = _parse_cash_income(df[income_col])

    # Rename UID
    if "Unique Identifier" in df.columns:
        df = df.rename(columns={"Unique Identifier": "uid_hash"})

    key = _ENROLL_KEY

    if "Service Attendance Date" not in df.columns:
        # Already enrollment-level (old format)
        rename = {}
        if "Last Start Date" in df.columns:
            rename["Last Start Date"] = "last_service_date"
        elif "Last Attendance Date" in df.columns:
            rename["Last Attendance Date"] = "last_service_date"
        if "Count" in df.columns:
            rename["Count"] = "service_count"
        return df.rename(columns=rename)

    # Compute service summary before dedup
    svc_summary = (
        df.groupby(key, sort=False)
        .agg(
            last_service_date=("Service Attendance Date", "max"),
            service_count=("Service Attendance Date", "count"),
        )
        .reset_index()
    )

    # Keep most-recent-snapshot row for enrollment fields
    drop_cols = [c for c in _RAW_SVC_COLS if c in df.columns]
    dedup = (
        df.sort_values("Service Attendance Date", ascending=False)
        .drop(columns=drop_cols)
        .drop_duplicates(subset=key, keep="first")
        .reset_index(drop=True)
    )

    return dedup.merge(svc_summary, on=key, how="left")


def _clean_enrollment(df: pd.DataFrame) -> pd.DataFrame:
    """Apply risk scoring and derived columns to an enrollment-level DataFrame."""

    # ── Dates ──────────────────────────────────────────────────────────────
    for col in ("Project Start Date", "Project Exit Date", "last_service_date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # ── Income (if not already parsed by ingest) ────────────────────────────
    if "Cash Income Amount" not in df.columns:
        income_col = ("Total Cash Income.1" if "Total Cash Income.1" in df.columns
                      else "Total Cash Income")
        if income_col in df.columns:
            df["Cash Income Amount"] = _parse_cash_income(df[income_col])

    # ── Substance use: boolean flag ─────────────────────────────────────────
    if "Substance Use Disorder" in df.columns:
        df["Has Substance Use Disorder"] = df["Substance Use Disorder"].isin(
            SUBSTANCE_USE_COLS
        )
    else:
        df["Has Substance Use Disorder"] = False

    # ── Days since last service ─────────────────────────────────────────────
    today = pd.Timestamp.today().normalize()
    if "last_service_date" in df.columns:
        df["Days Since Last Service"] = (today - df["last_service_date"]).dt.days
    else:
        df["Days Since Last Service"] = float("nan")

    # ── Risk score (0-8, one point per flag) ───────────────────────────────
    df["_risk_mental_health"]     = df.get("Mental Health",         pd.Series(dtype=str)).str.lower().eq("yes")
    df["_risk_substance"]          = df["Has Substance Use Disorder"]
    df["_risk_chronic"]            = df.get("Chronic Health",        pd.Series(dtype=str)).str.lower().eq("yes")
    df["_risk_developmental"]      = df.get("Developmental",         pd.Series(dtype=str)).str.lower().eq("yes")
    df["_risk_poor_health"]        = df.get("General Health Status", pd.Series(dtype=str)).str.lower().eq("poor")
    df["_risk_no_services"]        = df.get("service_count",         pd.Series(dtype=float)).fillna(0).eq(0)
    df["_risk_no_recent_contact"]  = (
        df["Days Since Last Service"].isna() | df["Days Since Last Service"].gt(21)
    )
    df["_risk_long_stay"]          = (
        df["Days in Project"].ge(60) & (df["Active in Project"] == "Yes")
    )

    risk_cols = [c for c in df.columns if c.startswith("_risk_")]
    df["Risk Score"] = df[risk_cols].sum(axis=1).astype(int)
    df["Risk Level"]  = pd.cut(
        df["Risk Score"],
        bins=[-1, 1, 3, 100],
        labels=["Low", "Medium", "High"],
    )

    return df
