#!/usr/bin/env python
"""
generate_report.py — Standalone Executive Housing Outcomes Report

Generates a beautifully formatted 8.5 × 11 inch PDF (or PNG) report of
positive housing outcomes from the FSC HMIS data export.

Usage
-----
    # All-time data → fsc_report.pdf
    python generate_report.py

    # Specific date range
    python generate_report.py --start-date 2025-01-01 --end-date 2025-12-31

    # Custom output path
    python generate_report.py --output reports/q1_2026.pdf

    # Specify the CSV directly (overrides auto-discovery)
    python generate_report.py --csv-path "path/to/export.csv"

    # Save as PNG instead of PDF
    python generate_report.py --format png

Options
-------
    --start-date  YYYY-MM-DD   Filter exits on/after this date (optional)
    --end-date    YYYY-MM-DD   Filter exits on/before this date (optional)
    --output      PATH          Output file path (default: fsc_report.pdf)
    --csv-path    PATH          Path to HMIS CSV export (auto-discovered if omitted)
    --format      pdf|png       Output format (default: pdf)
"""

from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path

# ── Make sure we can import from the core package ────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.loader import load_dataframe, DATA_DIR
from core.report_engine import (
    compute_positive_outcomes,
    build_report_figure,
    figure_to_bytes,
)


# ── Logo path (lives next to this script) ────────────────────────────────────
LOGO_PATH = PROJECT_ROOT / "fsc_logo.avif"


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate FSC Executive Housing Outcomes Report (PDF/PNG).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--start-date", metavar="YYYY-MM-DD",
        help="Include exits on or after this date.",
    )
    parser.add_argument(
        "--end-date", metavar="YYYY-MM-DD",
        help="Include exits on or before this date.",
    )
    parser.add_argument(
        "--output", metavar="PATH", default="fsc_report.pdf",
        help="Output file path (default: fsc_report.pdf).",
    )
    parser.add_argument(
        "--csv-path", metavar="PATH",
        help=(
            "Explicit path to the HMIS CSV export. "
            f"If omitted, auto-discovery searches {DATA_DIR} then the project root."
        ),
    )
    parser.add_argument(
        "--format", choices=["pdf", "png"], default="pdf",
        help="Output format (default: pdf).",
    )
    return parser.parse_args(argv)


# ── Data loading (with project-root fallback) ─────────────────────────────────

def _load_data(csv_path: str | None):
    """Load the DataFrame; fall back to project-root CSVs if DATA_DIR is empty."""
    if csv_path:
        return load_dataframe(csv_path)

    try:
        return load_dataframe()
    except FileNotFoundError:
        # DATA_DIR had no CSVs — try the project root directory
        local_csvs = sorted(
            glob.glob(str(PROJECT_ROOT / "*.csv")),
            key=lambda p: Path(p).stat().st_mtime,
            reverse=True,
        )
        if not local_csvs:
            print(
                "ERROR: No CSV file found.\n"
                f"  Searched: {DATA_DIR}\n"
                f"  Searched: {PROJECT_ROOT}\n"
                "Use --csv-path to specify the HMIS export directly.",
                file=sys.stderr,
            )
            sys.exit(1)

        chosen = local_csvs[0]
        print(f"INFO: Using CSV found in project root: {Path(chosen).name}")
        return load_dataframe(chosen)


# ── Entry point ───────────────────────────────────────────────────────────────

def main(argv=None):
    args = parse_args(argv)

    print("Loading HMIS data…")
    df = _load_data(args.csv_path)
    print(f"  {len(df):,} rows loaded.")

    print("Computing positive outcomes…")
    outcomes = compute_positive_outcomes(
        df,
        start_date=args.start_date,
        end_date=args.end_date,
    )

    ov = outcomes["overall"]
    print(
        f"\n  Date range : {outcomes['date_label']}\n"
        f"  Permanent  : {ov['permanent']:>4} distinct clients\n"
        f"  Temporary  : {ov['temporary']:>4} distinct clients\n"
        f"  Institutional (pos.) : {ov['institutional']:>4} distinct clients\n"
        f"  ─────────────────────────────────────\n"
        f"  Total Positive Outcomes : {ov['total_positive']:>4}\n"
        f"  (out of {ov['total_exits']} total exited clients)\n"
    )

    print("Building figure…")
    logo = LOGO_PATH if LOGO_PATH.exists() else None
    fig = build_report_figure(outcomes, logo_path=logo)

    # Determine output format from file extension if not explicitly set
    out_path = Path(args.output)
    fmt = args.format
    if out_path.suffix.lower() == ".png":
        fmt = "png"
    elif out_path.suffix.lower() == ".pdf":
        fmt = "pdf"

    print(f"Saving report → {out_path.resolve()} ({fmt.upper()})")
    raw = figure_to_bytes(fig, fmt=fmt)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)

    print("Done.")


if __name__ == "__main__":
    main()
