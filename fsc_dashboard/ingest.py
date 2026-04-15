#!/usr/bin/env python
"""
ingest.py -- FSC Data Ingestion Pipeline

Reads the raw service-level HMIS CSV export, anonymizes client UIDs via
HMAC-SHA256, and splits the data into two clean normalized tables:

    data/enrollments.csv  -- one row per (uid_hash, program, start_date)
                             with last_service_date and service_count baked in
    data/services.csv     -- one row per service event, linked by the same key

The salt file (data/.salt) is created on first run.  Without it the hashes
cannot be reversed to raw UIDs -- keep it out of version control.

Usage
-----
    python ingest.py                               # auto-discover newest CSV
    python ingest.py --csv-path path/to/file.csv
    python ingest.py --csv-path file.csv --data-dir path/to/output/
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import secrets
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent
_DEFAULT_DATA_DIR = PROJECT_ROOT / "data"

# Columns that are constant per enrollment (same value for every service row)
_ENROLLMENT_COLS = [
    "uid_hash",
    "Assigned Staff",
    "Assigned Staff Home Agency",
    "Name",
    "Active in Project",
    "Project Start Date",
    "Project Exit Date",
    "Destination",
    "Destination Category",
    "Hours Worked Last Week",
    "Medicare",
    "Days in Project",
    "Any Disability",
    "Chronic Health",
    "Developmental",
    "Mental Health",
    "Physical",
    "Substance Use Disorder",
    "Employment Seeking",
    "Employment Tenure",
    "General Health Status",
    "Cash Income Amount",
]

# Columns that vary per service event
_SERVICE_COLS = [
    "uid_hash",
    "Name",
    "Project Start Date",
    "Service Item Name",
    "Service Attendance Date",
    "Count",
]

_ENROLL_KEY = ["uid_hash", "Name", "Project Start Date"]

# Raw service columns to drop from the enrollment table
_RAW_SVC_COLS = {
    "Service Attendance Date",
    "Service Item Name",
    "Count",
    "Last Start Date",
    "Last Attendance Date",
    "Total Cash Income",
    "Total Cash Income.1",
}


# ── UID hashing ───────────────────────────────────────────────────────────────

def _load_or_create_salt(data_dir: Path) -> bytes:
    salt_file = data_dir / ".salt"
    if salt_file.exists():
        return salt_file.read_bytes()
    salt = secrets.token_bytes(32)
    salt_file.write_bytes(salt)
    print("  Created new salt file: data/.salt")
    print("  IMPORTANT: Keep data/.salt private -- UIDs cannot be traced without it.\n")
    return salt


def _hash_uid(raw_uid: str, salt: bytes) -> str:
    """HMAC-SHA256 of raw UID, truncated to 16 hex chars."""
    return hmac.new(salt, str(raw_uid).encode(), hashlib.sha256).hexdigest()[:16]


# ── CSV helpers ───────────────────────────────────────────────────────────────

def _parse_cash_income(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.replace(r"[$,]", "", regex=True)
        .pipe(pd.to_numeric, errors="coerce")
    )


def _find_raw_csv(data_dir: Path) -> Path:
    """Auto-discover the newest raw CSV in data/ then the project root."""
    for search_dir in [data_dir, PROJECT_ROOT, PROJECT_ROOT.parent / "ISP"]:
        candidates = sorted(
            [p for p in Path(search_dir).glob("*.csv")
             if p.stem not in ("enrollments", "services")],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            return candidates[0]
    raise FileNotFoundError(
        "No raw CSV found in data/, project root, or ISP/.\n"
        "Use --csv-path to specify the HMIS export directly."
    )


# ── Main ingest logic ─────────────────────────────────────────────────────────

def run_ingest(
    csv_path: Path | str | None = None,
    data_dir: Path | str | None = None,
) -> dict:
    """
    Ingest a raw service-level HMIS CSV into clean enrollment + service tables.

    Parameters
    ----------
    csv_path : path to the raw HMIS CSV (auto-discovered if None)
    data_dir : directory to write enrollments.csv, services.csv, and .salt
               (default: <project_root>/data/)

    Returns
    -------
    dict with keys: raw_rows, service_rows, enrollments, distinct_clients,
                    enrollments_path, services_path
    """
    data_dir = Path(data_dir) if data_dir else _DEFAULT_DATA_DIR
    data_dir.mkdir(exist_ok=True)

    enrollments_out = data_dir / "enrollments.csv"
    services_out    = data_dir / "services.csv"

    csv_path = Path(csv_path) if csv_path else _find_raw_csv(data_dir)
    print(f"  Source CSV : {csv_path.name}")

    # ── Read ────────────────────────────────────────────────────────────────
    df = pd.read_csv(csv_path, index_col=0, low_memory=False)
    n_raw = len(df)
    print(f"  Raw rows   : {n_raw:,}")

    # ── Parse dates ─────────────────────────────────────────────────────────
    df["Project Start Date"] = pd.to_datetime(df["Project Start Date"], errors="coerce")
    df["Project Exit Date"]  = pd.to_datetime(df["Project Exit Date"],  errors="coerce")
    if "Service Attendance Date" in df.columns:
        df["Service Attendance Date"] = pd.to_datetime(df["Service Attendance Date"], errors="coerce")

    # ── Parse income ─────────────────────────────────────────────────────────
    income_col = "Total Cash Income.1" if "Total Cash Income.1" in df.columns else "Total Cash Income"
    if income_col in df.columns:
        df["Cash Income Amount"] = _parse_cash_income(df[income_col])

    # ── Hash UIDs ─────────────────────────────────────────────────────────────
    salt = _load_or_create_salt(data_dir)
    df["uid_hash"] = df["Unique Identifier"].apply(lambda u: _hash_uid(u, salt))
    df = df.drop(columns=["Unique Identifier"])

    # ── Service summary per enrollment ────────────────────────────────────────
    if "Service Attendance Date" in df.columns:
        svc_summary = (
            df.groupby(_ENROLL_KEY, sort=False)
            .agg(
                last_service_date=("Service Attendance Date", "max"),
                service_count=("Service Attendance Date", "count"),
            )
            .reset_index()
        )
    else:
        # Already enrollment-level (no service dimension)
        svc_summary = df[_ENROLL_KEY].copy()
        svc_summary["last_service_date"] = pd.NaT
        svc_summary["service_count"] = 1

    # ── Services table ─────────────────────────────────────────────────────────
    svc_cols_present = [c for c in _SERVICE_COLS if c in df.columns]
    services_df = df[svc_cols_present].copy()
    services_df.to_csv(services_out, index=False)
    print(f"  Service rows written : {len(services_df):,}  -> services.csv")

    # ── Enrollment table (deduplicate to one row per uid_hash+Name+StartDate) ─
    # Sort descending by service date so the most recent snapshot of enrollment
    # fields (Days in Project, Active in Project, etc.) comes first.
    if "Service Attendance Date" in df.columns:
        df = df.sort_values("Service Attendance Date", ascending=False)

    drop_cols = [c for c in _RAW_SVC_COLS if c in df.columns]
    dedup = (
        df.drop(columns=drop_cols)
        .drop_duplicates(subset=_ENROLL_KEY, keep="first")
        .reset_index(drop=True)
    )

    # Keep only known enrollment columns that are actually present
    enroll_cols_present = [c for c in _ENROLLMENT_COLS if c in dedup.columns]
    extra_key_cols      = [c for c in _ENROLL_KEY if c not in enroll_cols_present]
    dedup = dedup[extra_key_cols + enroll_cols_present].copy()

    # Merge in aggregated service summary
    enrollments_df = dedup.merge(svc_summary, on=_ENROLL_KEY, how="left")

    enrollments_df.to_csv(enrollments_out, index=False)
    n_enrollments   = len(enrollments_df)
    n_clients       = enrollments_df["uid_hash"].nunique()
    print(f"  Enrollments written  : {n_enrollments:,}  -> enrollments.csv")
    print(f"  Distinct clients     : {n_clients:,}")

    return {
        "raw_rows":        n_raw,
        "service_rows":    len(services_df),
        "enrollments":     n_enrollments,
        "distinct_clients": n_clients,
        "enrollments_path": str(enrollments_out),
        "services_path":    str(services_out),
    }


# ── CLI ────────────────────────────────────────────────────────────────────────

def _parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Ingest raw HMIS CSV into clean enrollment + service tables.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--csv-path", metavar="PATH",
                   help="Path to raw HMIS CSV export (auto-discovered if omitted).")
    p.add_argument("--data-dir", metavar="DIR", default=str(_DEFAULT_DATA_DIR),
                   help=f"Output directory (default: {_DEFAULT_DATA_DIR}).")
    return p.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv)
    print("FSC Ingest Pipeline")
    print("-------------------")
    run_ingest(csv_path=args.csv_path or None, data_dir=args.data_dir)
    print("\nDone. Start the webapp: .\\run.ps1")


if __name__ == "__main__":
    main()
