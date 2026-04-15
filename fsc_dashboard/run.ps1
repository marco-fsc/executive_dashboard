# run.ps1 - Launch the FSC Dashboard web application (Windows PowerShell)
#
# Usage:
#   .\run.ps1          # starts on default port 8000
#   .\run.ps1 8080     # starts on a custom port

param(
    [int]$Port = 8000
)

Set-Location $PSScriptRoot

# Find a python.exe that can actually import Django
$candidates = @(
    (Join-Path $PSScriptRoot ".venv\Scripts\python.exe"),
    (Join-Path (Split-Path $PSScriptRoot -Parent) ".venv\Scripts\python.exe"),
    (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) ".venv\Scripts\python.exe"),
    "python"
)

$PYTHON = $null
foreach ($p in $candidates) {
    if (-not (Test-Path $p -ErrorAction SilentlyContinue) -and $p -ne "python") { continue }
    $check = & $p -c "import django" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $PYTHON = $p
        Write-Host "Using: $p" -ForegroundColor DarkGray
        break
    }
}

if (-not $PYTHON) {
    Write-Error "No Python with Django found. Run: pip install django"
    exit 1
}

Write-Host ""
Write-Host "Starting FSC Dashboard on http://127.0.0.1:$Port/" -ForegroundColor Green
Write-Host ""
Write-Host "  Executive Dashboard : http://127.0.0.1:$Port/" -ForegroundColor Cyan
Write-Host "  Supervisor View     : http://127.0.0.1:$Port/supervisor/" -ForegroundColor Cyan
Write-Host "  Client List         : http://127.0.0.1:$Port/clients/" -ForegroundColor Cyan
Write-Host "  Download Report     : http://127.0.0.1:$Port/report/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

& $PYTHON manage.py runserver "127.0.0.1:$Port"
