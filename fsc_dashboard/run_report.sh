#!/usr/bin/env bash
# run_report.sh — Generate the FSC Executive Housing Outcomes PDF report
#
# Usage:
#   ./run_report.sh                                          # all-time data
#   ./run_report.sh --start-date 2025-01-01 --end-date 2025-12-31
#   ./run_report.sh --output reports/q1_2026.pdf
#   ./run_report.sh --csv-path "../ISP/export.csv"
#   ./run_report.sh --format png
#
# All flags are passed straight through to generate_report.py.
# Run from the fsc_dashboard/ project root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Resolve Python ────────────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  PYTHON=python3
elif command -v python &>/dev/null; then
  PYTHON=python
else
  echo "ERROR: No Python interpreter found. Install Python 3.9+ and try again." >&2
  exit 1
fi

echo "Using Python: $($PYTHON --version)"
echo "Working dir : $SCRIPT_DIR"
echo ""

# ── Run the report ────────────────────────────────────────────────────────────
"$PYTHON" generate_report.py "$@"

# ── Open the output file (cross-platform) ─────────────────────────────────────
# Determine the output path from the args (default is fsc_report.pdf)
OUTPUT="fsc_report.pdf"
for arg in "$@"; do
  if [[ "$PREV" == "--output" ]]; then
    OUTPUT="$arg"
  fi
  PREV="$arg"
done

echo ""
echo "Opening $OUTPUT …"
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$OUTPUT"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$OUTPUT" &
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  start "$OUTPUT"
fi
