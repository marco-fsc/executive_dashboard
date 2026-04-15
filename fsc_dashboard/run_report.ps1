# run_report.ps1 - Generate the FSC Executive Housing Outcomes PDF report (Windows)
#
# Usage:
#   .\run_report.ps1
#   .\run_report.ps1 --start-date 2025-01-01 --end-date 2025-12-31
#   .\run_report.ps1 --output reports/q1_2026.pdf
#   .\run_report.ps1 --format png

Set-Location $PSScriptRoot

# Resolve Python - prefer the venv interpreter directly
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $PYTHON = $venvPython
} else {
    $PYTHON = "python"
    Write-Warning ".venv not found - using system Python."
}

# Run the report
& $PYTHON generate_report.py @args

# Open the output file
$output = "fsc_report.pdf"
for ($i = 0; $i -lt $args.Count - 1; $i++) {
    if ($args[$i] -eq "--output") {
        $output = $args[$i + 1]
    }
}

if (Test-Path $output) {
    Write-Host ""
    Write-Host "Opening $output ..." -ForegroundColor Green
    Start-Process $output
}
