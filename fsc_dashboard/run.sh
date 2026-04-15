#!/usr/bin/env bash
# run.sh — Launch the FSC Dashboard web application (Git Bash / WSL / macOS / Linux)
# Windows PowerShell users: run run.ps1 instead.
#
# Usage:
#   ./run.sh              # starts on default port 8000
#   ./run.sh 8080         # starts on a custom port
#
# Then open: http://127.0.0.1:<port>/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${1:-8000}"

# ── Resolve Python ────────────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  PYTHON=python3
elif command -v python &>/dev/null; then
  PYTHON=python
else
  echo "ERROR: No Python interpreter found. Install Python 3.9+ and try again." >&2
  exit 1
fi

echo "Using Python : $($PYTHON --version)"
echo "Working dir  : $SCRIPT_DIR"
echo "Starting FSC Dashboard on http://127.0.0.1:$PORT/"
echo ""
echo "  Executive Dashboard : http://127.0.0.1:$PORT/"
echo "  Supervisor View     : http://127.0.0.1:$PORT/supervisor/"
echo "  Client List         : http://127.0.0.1:$PORT/clients/"
echo "  Download Report     : http://127.0.0.1:$PORT/report/"
echo ""
echo "Press Ctrl+C to stop."
echo "────────────────────────────────────────────────"

"$PYTHON" manage.py runserver "127.0.0.1:$PORT"
