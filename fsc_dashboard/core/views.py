import json
from pathlib import Path

from django.http import HttpResponse, JsonResponse
from django.shortcuts import render

from . import services
from .loader import load_dataframe, invalidate_cache
from .export import export_excel, export_pdf_response


# ── CEO Dashboard ─────────────────────────────────────────────────────────────

def executive_dashboard(request):
    program = request.GET.get("program") or None
    date_range = request.GET.get("range", "6")
    months_map = {"1": 1, "6": 6, "18": 18}
    months = months_map.get(date_range, 6)
    range_labels = {"1": "Last Month", "6": "Last 6 Months", "18": "Last 18 Months"}

    # Parse selected service items (multi-value checkbox GET params)
    svc_param = request.GET.getlist("svc_items")
    selected_svc_items = [s.strip() for s in svc_param if s.strip()] or None

    kpis = services.executive_kpis(program=program, months=months)
    can_kpis = services.can_kpis(months=months)
    programs_list = services.program_list()
    programs = services.program_summary(program=program, months=months)
    exits_bar_chart = services.positive_exits_by_program(months=months, program=program)
    los_chart = services.los_histogram_data(program=program)
    active_chart = services.active_by_program_chart(program=program)
    trend_chart = services.positive_outcomes_trend(months=months, program=program)
    can_chart = services.can_trend(months=months)
    svc_counts = services.service_counts(items=selected_svc_items, months=months, program=program)
    all_svc_items = services.DEFAULT_SERVICE_ITEMS

    return render(request, "core/executive_dashboard.html", {
        "kpis": kpis,
        "programs": programs,
        "programs_list": programs_list,
        "selected_program": program or "",
        "selected_range": date_range,
        "range_label": range_labels.get(date_range, "Last 6 Months"),
        "is_forecast": trend_chart.get("is_forecast", False),
        "exits_bar_chart_json": json.dumps(exits_bar_chart),
        "los_chart_json": json.dumps(los_chart),
        "active_chart_json": json.dumps(active_chart),
        "trend_chart_json": json.dumps(trend_chart),
        "can_chart_json": json.dumps(can_chart),
        "svc_counts": svc_counts,
        "all_svc_items": all_svc_items,
        "selected_svc_items": selected_svc_items or services.DEFAULT_SERVICE_ITEMS,
        "can_kpis": can_kpis,
    })


# ── Supervisor Dashboard ──────────────────────────────────────────────────────

def supervisor_dashboard(request):
    program = request.GET.get("program") or None
    programs = services.program_list()
    cms = services.cm_summary(program=program)

    return render(request, "core/supervisor_dashboard.html", {
        "programs": programs,
        "selected_program": program,
        "cms": cms,
    })


# ── Client List ───────────────────────────────────────────────────────────────

def client_list(request):
    program = request.GET.get("program") or None
    cm = request.GET.get("cm") or None
    risk_level = request.GET.get("risk") or None
    active_only = request.GET.get("active_only", "1") == "1"
    no_services = request.GET.get("no_services") == "1"
    no_recent = request.GET.get("no_recent") == "1"
    approaching = request.GET.get("approaching_60") == "1"

    try:
        min_days = int(request.GET["min_days"]) if request.GET.get("min_days") else None
        max_days = int(request.GET["max_days"]) if request.GET.get("max_days") else None
    except ValueError:
        min_days = max_days = None

    clients = services.client_list(
        program=program,
        cm=cm,
        active_only=active_only,
        risk_level=risk_level,
        min_days=min_days,
        max_days=max_days,
        no_services=no_services,
        no_recent_contact=no_recent,
        approaching_60=approaching,
    )

    programs = services.program_list()
    cms_for_filter = services.cm_list(program=program)

    return render(request, "core/client_list.html", {
        "clients": clients,
        "programs": programs,
        "cms": cms_for_filter,
        "total": len(clients),
        "filters": {
            "program": program or "",
            "cm": cm or "",
            "risk": risk_level or "",
            "active_only": active_only,
            "no_services": no_services,
            "no_recent": no_recent,
            "approaching_60": approaching,
            "min_days": min_days or "",
            "max_days": max_days or "",
        },
    })


# ── Export ────────────────────────────────────────────────────────────────────

def export_view(request):
    fmt = request.GET.get("format", "excel")
    report = request.GET.get("report", "clients")
    program = request.GET.get("program") or None
    cm = request.GET.get("cm") or None

    if report == "executive":
        date_range = request.GET.get("range", "6")
        months_map = {"1": 1, "6": 6, "18": 18}
        months = months_map.get(date_range, 6)
        range_labels = {"1": "Last Month", "6": "Last 6 Months", "18": "Last 18 Months"}
        range_label = range_labels.get(date_range, "Last 6 Months")
        kpis = services.executive_kpis(program=program, months=months)
        programs_data = services.program_summary(program=program, months=months)
        exits_chart = services.positive_exits_by_program(months=months, program=program)
        svc_counts = services.service_counts(months=months, program=program)
        can_kpis_data = services.can_kpis(months=months)
        data = {
            "kpis": kpis,
            "programs": programs_data,
            "exits_chart": exits_chart,
            "svc_counts": svc_counts,
            "can_kpis": can_kpis_data,
            "range_label": range_label,
            "program": program or "All Programs",
        }
    else:
        data = services.client_list(program=program, cm=cm)

    if fmt == "pdf":
        return export_pdf_response(data, report)
    return export_excel(data, report)


# ── Upload / reload ───────────────────────────────────────────────────────────

def upload_csv(request):
    if request.method == "POST" and request.FILES.get("csv_file"):
        import sys
        from pathlib import Path

        # Save raw CSV to data/
        raw_dir = Path(__file__).resolve().parent.parent / "data"
        raw_dir.mkdir(exist_ok=True)

        f = request.FILES["csv_file"]
        raw_path = raw_dir / f.name
        with open(raw_path, "wb") as out:
            for chunk in f.chunks():
                out.write(chunk)

        # Run ingest pipeline (hash UIDs + split into enrollments + services)
        project_root = str(Path(__file__).resolve().parent.parent)
        if project_root not in sys.path:
            sys.path.insert(0, project_root)

        try:
            import ingest
            ingest.run_ingest(csv_path=raw_path, data_dir=raw_dir)
        except Exception as exc:
            # Ingest failed — app still works via raw CSV fallback
            import logging
            logging.getLogger(__name__).warning("ingest failed: %s", exc)

        invalidate_cache()
        from django.shortcuts import redirect
        return redirect("executive_dashboard")

    return render(request, "core/upload.html")


# ── Printable Executive Report (PDF download) ─────────────────────────────────

def report_view(request):
    """
    Generate and stream the executive housing outcomes report as a PDF.

    Query parameters (all optional):
        start_date  YYYY-MM-DD  — include exits on or after this date
        end_date    YYYY-MM-DD  — include exits on or before this date
        format      pdf | png   — output format (default: pdf)
    """
    from .report_engine import compute_positive_outcomes, build_report_figure, figure_to_bytes

    start_date = request.GET.get("start_date") or None
    end_date   = request.GET.get("end_date")   or None
    fmt        = request.GET.get("format", "pdf").lower()
    if fmt not in ("pdf", "png"):
        fmt = "pdf"

    df       = load_dataframe()
    outcomes = compute_positive_outcomes(df, start_date=start_date, end_date=end_date)

    logo_path = Path(__file__).resolve().parent.parent / "fsc_logo.avif"
    fig       = build_report_figure(outcomes, logo_path=logo_path if logo_path.exists() else None)
    data      = figure_to_bytes(fig, fmt=fmt)

    content_types = {"pdf": "application/pdf", "png": "image/png"}
    filename      = f"fsc_outcomes_report.{fmt}"

    response = HttpResponse(data, content_type=content_types[fmt])
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

