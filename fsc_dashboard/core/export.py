"""
Export helpers: Excel (.xlsx) and a plain PDF via html-to-pdf approach.
WeasyPrint has heavy system deps on Windows, so we use a simple matplotlib
table approach for PDF, keeping the dependency list minimal.
"""
from __future__ import annotations

import io
from datetime import date

import pandas as pd
from django.http import HttpResponse


def export_excel(data, report: str) -> HttpResponse:
    """Return an HttpResponse with an .xlsx attachment."""
    output = io.BytesIO()
    today = date.today().isoformat()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        if report == "executive" and isinstance(data, dict):
            kpi_df = pd.DataFrame([data["kpis"]])
            kpi_df.to_excel(writer, sheet_name="KPIs", index=False)
            prog_df = pd.DataFrame(data["programs"])
            prog_df.to_excel(writer, sheet_name="Programs", index=False)
        else:
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data
            # Drop internal flag columns
            drop_cols = [c for c in df.columns if c.startswith("_risk_")]
            df = df.drop(columns=drop_cols, errors="ignore")
            df.to_excel(writer, sheet_name="Report", index=False)

    output.seek(0)
    filename = f"fsc_{report}_{today}.xlsx"
    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def export_pdf_response(data, report: str) -> HttpResponse:  # noqa: C901
    """
    Board-ready multi-page PDF.
    Layout (portrait-first):
      P1  Cover           8.5×11 portrait
      P2  KPI Cards       8.5×11 portrait
      P3  CAN + Exits     8.5×11 portrait  (combined)
      P4  Services        8.5×11 portrait
      P5  Program Table   11×8.5 landscape (many columns need width)

    Uses axes.set_facecolor() for colored bands — reliably renders in PDF
    backend (fig.add_artist Rectangle approach does NOT paint reliably).
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
        from matplotlib.backends.backend_pdf import PdfPages
        import numpy as np
        import math
        import re as _re
        from pathlib import Path
    except ImportError:
        return export_excel(data, report)

    # ── Brand colours ──────────────────────────────────────────────────────
    FSC_GREEN  = "#1e5128"
    FSC_GREEN2 = "#2d7a3a"
    FSC_YELLOW = "#f5e642"
    PALE_GREEN = "#eaf4eb"
    LIGHT_GREY = "#f4f5f4"
    MID_GREY   = "#ced4da"
    TEXT_DARK  = "#1a1a1a"
    TEXT_MUTED = "#6c757d"

    PROG_COLORS = [
        "#1e5128", "#228B22", "#52BE80", "#0d6efd",
        "#6610f2", "#fd7e14", "#dc3545", "#0dcaf0", "#A9DFBF",
    ]

    output    = io.BytesIO()
    today     = date.today()
    today_str = today.strftime("%B %d, %Y")

    # ── Load logo ──────────────────────────────────────────────────────────
    logo_arr = None
    try:
        from PIL import Image
        logo_path = Path(__file__).resolve().parent.parent / "fsc_logo.avif"
        if logo_path.exists():
            img = Image.open(logo_path).convert("RGBA")
            img.thumbnail((300, 300), Image.LANCZOS)
            # Composite onto white background so transparency is removed
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            bg.paste(img, mask=img)
            logo_arr = np.array(bg.convert("RGB"))
    except Exception:
        pass

    # ── Shared helpers ─────────────────────────────────────────────────────

    def _clean(ax):
        """Strip all decorations from an axes (keep facecolor)."""
        for sp in ax.spines.values():
            sp.set_visible(False)
        ax.set_xticks([])
        ax.set_yticks([])

    def _header(fig, title: str, subtitle: str = "") -> float:
        """
        Draw a green header band + yellow stripe using axes (PDF-reliable).
        Returns the y-coordinate (figure fraction) of the bottom of the stripe.
        """
        H   = 0.12   # header height as fraction of figure
        STR = 0.010  # yellow stripe height

        # Green band
        ax_h = fig.add_axes([0, 1 - H, 1, H])
        ax_h.set_facecolor(FSC_GREEN)
        ax_h.set_xlim(0, 1)
        ax_h.set_ylim(0, 1)
        _clean(ax_h)

        # Yellow stripe below green band
        ax_y = fig.add_axes([0, 1 - H - STR, 1, STR])
        ax_y.set_facecolor(FSC_YELLOW)
        _clean(ax_y)

        # Logo (top-right inside green band)
        if logo_arr is not None:
            ax_logo = fig.add_axes([0.83, 1 - H + 0.006, 0.14, H - 0.012])
            ax_logo.imshow(logo_arr)
            ax_logo.axis("off")

        # Text inside green band axes
        ax_h.text(0.025, 0.70, "First Step Communities",
                  color=FSC_YELLOW, fontsize=11, fontweight="bold", va="center")
        ax_h.text(0.025, 0.26, title,
                  color="white", fontsize=8.5, style="italic", va="center")
        if subtitle:
            ax_h.text(0.80, 0.50, subtitle,
                      color="white", fontsize=7.5, ha="right", va="center")

        return 1 - H - STR  # content should start at or below this y

    def _footer(fig) -> float:
        """Light grey footer. Returns top y of footer (content bottom boundary)."""
        H = 0.045
        ax_f = fig.add_axes([0, 0, 1, H])
        ax_f.set_facecolor(LIGHT_GREY)
        ax_f.set_xlim(0, 1)
        ax_f.set_ylim(0, 1)
        _clean(ax_f)
        ax_f.text(0.025, 0.50,
                  f"Generated {today_str}  ·  FSC Participant Dashboard",
                  color=TEXT_MUTED, fontsize=6.5, va="center")
        ax_f.text(0.975, 0.50, "CONFIDENTIAL",
                  color=TEXT_MUTED, fontsize=6.5, ha="right", va="center")
        return H

    def _section_label(fig, y_fig, text):
        """Small bold section label in FSC green."""
        fig.text(0.5, y_fig, text,
                 color=FSC_GREEN, fontsize=10, fontweight="bold",
                 ha="center", va="center")

    with PdfPages(output) as pdf:
        if report == "executive" and isinstance(data, dict):
            kpis        = data.get("kpis", {})
            programs    = data.get("programs", [])
            exits_chart = data.get("exits_chart", {})
            svc_counts  = data.get("svc_counts", [])
            can_kpis    = data.get("can_kpis", {})
            range_label = data.get("range_label", "")
            prog_label  = data.get("program", "All Programs")
            subtitle    = f"{range_label}  ·  {prog_label}"

            # ══════════════════════════════════════════════════════════════
            # PAGE 1 — COVER  (portrait 8.5 × 11)
            # ══════════════════════════════════════════════════════════════
            fig = plt.figure(figsize=(8.5, 11))
            fig.patch.set_facecolor("white")

            # Green top 62%
            ax_cov = fig.add_axes([0, 0.36, 1, 0.64])
            ax_cov.set_facecolor(FSC_GREEN)
            ax_cov.set_xlim(0, 1)
            ax_cov.set_ylim(0, 1)
            _clean(ax_cov)

            # Yellow stripe
            ax_cs = fig.add_axes([0, 0.352, 1, 0.012])
            ax_cs.set_facecolor(FSC_YELLOW)
            _clean(ax_cs)

            # Cover text (in green axes coords)
            ax_cov.text(0.5, 0.93, "First Step Communities",
                        color=FSC_YELLOW, fontsize=34, fontweight="bold",
                        ha="center", va="center")

            # Logo centered between title and subtitle
            if logo_arr is not None:
                ax_cl = fig.add_axes([0.37, 0.76, 0.26, 0.14])
                ax_cl.imshow(logo_arr)
                ax_cl.axis("off")

            ax_cov.text(0.5, 0.48, "Executive Dashboard Report",
                        color="white", fontsize=20, ha="center", va="center")
            ax_cov.text(0.5, 0.38, range_label,
                        color="white", fontsize=14, style="italic",
                        ha="center", va="center")
            if prog_label != "All Programs":
                ax_cov.text(0.5, 0.35, prog_label,
                            color=FSC_YELLOW, fontsize=12,
                            ha="center", va="center")

            # 4 headline KPI cards in white bottom (y≈0.04–0.33)
            ax_k = fig.add_axes([0.04, 0.04, 0.92, 0.30])
            ax_k.set_xlim(0, 1)
            ax_k.set_ylim(0, 1)
            ax_k.patch.set_visible(False)
            _clean(ax_k)

            cover_cards = [
                (str(kpis.get("total_active", "—")),             "Active Clients"),
                (str(kpis.get("total_exits", "—")),              "Total Exits"),
                (f"{kpis.get('perm_housing_exits', '—')}",        "→ Permanent\nHousing"),
                (f"{kpis.get('perm_housing_pct', '—')}%",         "Perm Housing\nRate"),
            ]
            nc = len(cover_cards)
            cw, cgap = 0.22, 0.025
            cx0 = (1 - nc * cw - (nc - 1) * cgap) / 2
            for i, (val, lbl) in enumerate(cover_cards):
                cx = cx0 + i * (cw + cgap)
                ax_k.add_patch(mpatches.FancyBboxPatch(
                    (cx, 0.06), cw, 0.86,
                    boxstyle="round,pad=0.02",
                    facecolor=PALE_GREEN, edgecolor=FSC_GREEN,
                    linewidth=1.5, transform=ax_k.transAxes, clip_on=False,
                ))
                ax_k.add_patch(mpatches.Rectangle(
                    (cx, 0.90), cw, 0.04,
                    facecolor=FSC_GREEN, linewidth=0,
                    transform=ax_k.transAxes, clip_on=False,
                ))
                ax_k.text(cx + cw / 2, 0.62, val,
                          color=FSC_GREEN, fontsize=22, fontweight="bold",
                          ha="center", va="center", transform=ax_k.transAxes)
                ax_k.text(cx + cw / 2, 0.24, lbl,
                          color=TEXT_MUTED, fontsize=8,
                          ha="center", va="center", transform=ax_k.transAxes,
                          multialignment="center")

            fig.text(0.5, 0.017,
                     f"Generated {today_str}  ·  CONFIDENTIAL",
                     color=TEXT_MUTED, fontsize=8, ha="center", va="center")

            pdf.savefig(fig, bbox_inches="tight")
            plt.close(fig)

            # ══════════════════════════════════════════════════════════════
            # PAGE 2 — KPI CARDS  (portrait 8.5 × 11)
            # ══════════════════════════════════════════════════════════════
            fig = plt.figure(figsize=(8.5, 11))
            fig.patch.set_facecolor("white")
            top = _header(fig, "Key Performance Indicators — Housing Programs", subtitle)
            bot = _footer(fig)

            kpi_items = [
                ("Active Clients",
                 kpis.get("total_active"),            FSC_GREEN),
                ("Total Exits",
                 kpis.get("total_exits"),             TEXT_MUTED),
                ("→ Permanent Housing",
                 f"{kpis.get('perm_housing_exits')} ({kpis.get('perm_housing_pct')}%)",
                 FSC_GREEN2),
                ("→ Homelessness",
                 f"{kpis.get('homeless_exits')} ({kpis.get('homeless_exit_pct')}%)",
                 "#dc3545"),
                ("Long Stay ≥ 90 Days",
                 f"{kpis.get('long_stay_count')} ({kpis.get('long_stay_pct')}%)",
                 "#fd7e14"),
                ("Approaching 60 Days",
                 kpis.get("approaching_60_days"),     "#fd7e14"),
                ("Active / No Services",
                 kpis.get("zero_services_active"),    "#dc3545"),
                ("No Contact > 21 Days",
                 kpis.get("no_recent_contact"),       "#fd7e14"),
                ("Avg Length of Stay",
                 f"{kpis.get('avg_length_of_stay')} days",
                 TEXT_MUTED),
                ("Avg CM Caseload",
                 kpis.get("avg_cm_load"),             TEXT_MUTED),
                ("Max CM Caseload",
                 kpis.get("max_cm_load"),             TEXT_MUTED),
            ]

            # 3 cols × 4 rows (portrait fits nicely)
            cols, rows_p = 3, 4
            content_h = top - bot
            cw_k = 0.90 / cols
            ch_k = content_h / rows_p
            px_k, py_k = 0.016, 0.010

            for idx, (lbl, val, color) in enumerate(kpi_items):
                ci = idx % cols
                ri = idx // cols
                x0 = 0.05 + ci * cw_k
                y0 = bot + (rows_p - ri - 1) * ch_k + py_k
                w  = cw_k - 2 * px_k
                h  = ch_k - 2 * py_k

                # Draw card using figure-level axes (reliable)
                ax_card = fig.add_axes([x0, y0, w, h])
                ax_card.set_facecolor(LIGHT_GREY)
                ax_card.set_xlim(0, 1)
                ax_card.set_ylim(0, 1)
                for sp in ax_card.spines.values():
                    sp.set_color(MID_GREY)
                    sp.set_linewidth(0.8)
                ax_card.set_xticks([])
                ax_card.set_yticks([])

                # Left accent bar
                ax_card.add_patch(mpatches.Rectangle(
                    (0, 0), 0.03, 1,
                    facecolor=color, linewidth=0,
                    transform=ax_card.transAxes, clip_on=True,
                ))
                ax_card.text(0.55, 0.64, str(val),
                             color=color, fontsize=16, fontweight="bold",
                             ha="center", va="center")
                ax_card.text(0.55, 0.22, lbl,
                             color=TEXT_DARK, fontsize=7.5,
                             ha="center", va="center", multialignment="center")

            pdf.savefig(fig, bbox_inches="tight")
            plt.close(fig)

            # ══════════════════════════════════════════════════════════════
            # PAGE 3 — CAN TEAM + EXITS BAR  (portrait 8.5 × 11, combined)
            # ══════════════════════════════════════════════════════════════
            has_can   = bool(can_kpis)
            has_exits = bool(exits_chart.get("labels"))

            if has_can or has_exits:
                fig = plt.figure(figsize=(8.5, 11))
                fig.patch.set_facecolor("white")
                top = _header(fig, "CAN Outreach  ·  Positive Exits by Program", subtitle)
                bot = _footer(fig)
                content_h = top - bot

                # Allocate vertical space
                if has_can and has_exits:
                    split = 0.40          # CAN gets top 40%, exits get bottom 60%
                    can_top  = top
                    can_bot  = top - content_h * split
                    exit_top = can_bot - 0.018   # small gap
                    exit_bot = bot
                elif has_can:
                    can_top, can_bot = top, bot
                    exit_top = exit_bot = None
                else:
                    exit_top, exit_bot = top, bot
                    can_top = can_bot = None

                # ── CAN section ────────────────────────────────────────
                if has_can:
                    _section_label(fig, can_top - 0.022, "CAN Team Outreach")

                    # Divider line under label
                    ax_div = fig.add_axes([0.05, can_top - 0.030, 0.90, 0.003])
                    ax_div.set_facecolor(FSC_YELLOW)
                    _clean(ax_div)

                    can_items = [
                        ("Active\nNavigations",
                         can_kpis.get("active_navigations"), FSC_GREEN),
                        ("Clients\nNavigated",
                         can_kpis.get("total_exits"),        TEXT_MUTED),
                        ("Positive\nOutcomes",
                         f"{can_kpis.get('positive_exits')}\n({can_kpis.get('positive_pct')}%)",
                         FSC_GREEN2),
                        ("→ Shelter\nConnected",
                         can_kpis.get("shelter_connected"),  "#0d6efd"),
                        ("→ Permanent\nHousing",
                         can_kpis.get("perm_housing"),       FSC_GREEN),
                    ]

                    n_can = len(can_items)
                    card_area_top    = can_top - 0.038
                    card_area_bot    = can_bot + 0.022
                    card_area_height = card_area_top - card_area_bot
                    total_cw = 0.86
                    cw_c = total_cw / n_can
                    gap  = 0.010
                    cx0_c = (1 - total_cw) / 2

                    for i, (lbl, val, color) in enumerate(can_items):
                        cx = cx0_c + i * cw_c
                        ax_c = fig.add_axes([
                            cx + gap / 2,
                            card_area_bot,
                            cw_c - gap,
                            card_area_height,
                        ])
                        ax_c.set_facecolor("white")
                        ax_c.set_xlim(0, 1)
                        ax_c.set_ylim(0, 1)
                        for sp in ax_c.spines.values():
                            sp.set_linewidth(1.5)
                            sp.set_color(color)
                        ax_c.set_xticks([])
                        ax_c.set_yticks([])
                        # Top accent bar
                        ax_c.add_patch(mpatches.Rectangle(
                            (0, 0.88), 1, 0.12,
                            facecolor=color, linewidth=0,
                            transform=ax_c.transAxes, clip_on=True,
                        ))
                        ax_c.text(0.5, 0.57, str(val),
                                  color=color, fontsize=14, fontweight="bold",
                                  ha="center", va="center",
                                  multialignment="center")
                        ax_c.text(0.5, 0.20, lbl,
                                  color=TEXT_MUTED, fontsize=7.5,
                                  ha="center", va="center",
                                  multialignment="center")

                    fig.text(
                        0.5, can_bot + 0.008,
                        "CAN navigates unsheltered individuals to shelter, services and housing.",
                        color=TEXT_MUTED, fontsize=7.5, ha="center", va="center",
                        style="italic",
                    )

                # ── Exits bar chart section ────────────────────────────
                if has_exits:
                    if has_can:
                        # Horizontal divider between sections
                        ax_hr = fig.add_axes([0.05, exit_top + 0.002, 0.90, 0.002])
                        ax_hr.set_facecolor(MID_GREY)
                        _clean(ax_hr)
                        _section_label(fig, exit_top - 0.018, "Positive Exits by Program")
                        chart_top = exit_top - 0.036
                    else:
                        chart_top = exit_top - 0.01

                    labels = exits_chart["labels"]
                    values = exits_chart["data"]
                    colors = exits_chart.get("colors", [FSC_GREEN] * len(labels))

                    ax_bar = fig.add_axes([
                        0.11, exit_bot + 0.005,
                        0.86, chart_top - exit_bot - 0.005,
                    ])
                    ax_bar.set_facecolor("white")
                    x = np.arange(len(labels))
                    bars = ax_bar.bar(x, values, color=colors,
                                     edgecolor="white", linewidth=0.5,
                                     width=0.62, zorder=3)
                    for bar, v in zip(bars, values):
                        ax_bar.text(
                            bar.get_x() + bar.get_width() / 2,
                            bar.get_height() + max(values) * 0.016,
                            f"{v:,}", ha="center", va="bottom",
                            fontsize=7.5, color=TEXT_DARK, fontweight="bold",
                        )
                    ax_bar.set_xticks(x)
                    ax_bar.set_xticklabels(
                        labels, rotation=25, ha="right",
                        fontsize=7, color=TEXT_DARK,
                    )
                    ax_bar.set_ylabel("Positive Exits", fontsize=8, color=TEXT_MUTED)
                    ax_bar.set_ylim(0, max(values) * 1.22)
                    ax_bar.yaxis.grid(True, color=MID_GREY, linestyle="--",
                                      linewidth=0.6, zorder=0)
                    ax_bar.set_axisbelow(True)
                    for sp in ax_bar.spines.values():
                        sp.set_visible(False)
                    ax_bar.tick_params(axis="y", colors=TEXT_MUTED, labelsize=7.5)
                    ax_bar.tick_params(axis="x", length=0)

                pdf.savefig(fig, bbox_inches="tight")
                plt.close(fig)

            # ══════════════════════════════════════════════════════════════
            # PAGE 4 — SERVICES PROVIDED  (portrait 8.5 × 11)
            # ══════════════════════════════════════════════════════════════
            if svc_counts:
                fig = plt.figure(figsize=(8.5, 11))
                fig.patch.set_facecolor("white")
                top = _header(fig, "Services Provided", subtitle)
                bot = _footer(fig)

                n_svc     = len(svc_counts)
                max_count = svc_counts[0]["count"] or 1

                # Content axes (transparent bg, axes coords)
                ax = fig.add_axes([0.04, bot, 0.94, top - bot])
                ax.set_xlim(0, 1)
                ax.set_ylim(0, 1)
                ax.patch.set_visible(False)
                _clean(ax)

                row_h   = min(0.90 / n_svc, 0.072)
                name_w  = 0.50   # fraction of axes width for service name
                count_w = 0.10   # fraction for the count number
                bar_x   = name_w + count_w + 0.01
                bar_max = 1.0 - bar_x - 0.008

                for i, row in enumerate(svc_counts):
                    y_top = 0.98 - i * (row_h + 0.003)
                    bg    = PALE_GREEN if i % 2 == 0 else "white"

                    # Row background
                    ax.add_patch(mpatches.Rectangle(
                        (0, y_top - row_h), 1, row_h,
                        facecolor=bg, linewidth=0,
                        transform=ax.transAxes, clip_on=False,
                    ))
                    # Service name
                    ax.text(0.012, y_top - row_h * 0.44, row["name"],
                            color=TEXT_DARK, fontsize=7.8, va="center",
                            transform=ax.transAxes)
                    # Count (bold green)
                    ax.text(name_w + count_w - 0.008, y_top - row_h * 0.44,
                            f"{row['count']:,}",
                            color=FSC_GREEN, fontsize=8.5, fontweight="bold",
                            va="center", ha="right", transform=ax.transAxes)
                    # Bar track (grey)
                    ax.add_patch(mpatches.Rectangle(
                        (bar_x, y_top - row_h * 0.78), bar_max, row_h * 0.46,
                        facecolor=MID_GREY, linewidth=0,
                        transform=ax.transAxes, clip_on=False,
                    ))
                    # Bar fill — cube-root scale for legible proportions
                    fill_w = (row["count"] / max_count) ** (1 / 3) * bar_max
                    ax.add_patch(mpatches.Rectangle(
                        (bar_x, y_top - row_h * 0.78), max(fill_w, 0.005), row_h * 0.46,
                        facecolor=FSC_GREEN, linewidth=0,
                        transform=ax.transAxes, clip_on=False,
                    ))

                pdf.savefig(fig, bbox_inches="tight")
                plt.close(fig)

            # ══════════════════════════════════════════════════════════════
            # PAGE 5 — PROGRAM SUMMARY TABLE  (landscape 11 × 8.5)
            # Landscape is necessary: 12 columns require horizontal space.
            # ══════════════════════════════════════════════════════════════
            if programs:
                col_defs = [
                    ("Program",    "program",        0.22),
                    ("Active",     "active",         0.065),
                    ("Exits",      "exits",          0.055),
                    ("→ Perm",     "perm_exits",     0.065),
                    ("Perm %",     "perm_pct",       0.060),
                    ("Positive",   "positive_exits", 0.065),
                    ("Pos %",      "positive_pct",   0.055),
                    ("→ Homeless", "homeless_exits", 0.075),
                    ("Avg LOS",    "avg_los",        0.065),
                    ("CMs",        "cms",            0.045),
                    ("Avg Load",   "avg_cm_load",    0.065),
                    ("No Svc",     "zero_services",  0.055),
                ]

                fig = plt.figure(figsize=(11, 8.5))
                fig.patch.set_facecolor("white")
                top = _header(fig, "Program Summary", subtitle)
                bot = _footer(fig)

                ax = fig.add_axes([0.02, bot, 0.96, top - bot])
                ax.set_xlim(0, 1)
                ax.set_ylim(0, 1)
                ax.patch.set_visible(False)
                _clean(ax)

                n_prog  = len(programs)
                row_h   = min((0.92 - 0.06) / (n_prog + 1), 0.072)
                hdr_y   = 0.97

                # Header row
                x_cur = 0.0
                for hdr, _, cw in col_defs:
                    ax.add_patch(mpatches.Rectangle(
                        (x_cur, hdr_y - row_h), cw - 0.002, row_h,
                        facecolor=FSC_GREEN, linewidth=0,
                        transform=ax.transAxes, clip_on=False,
                    ))
                    ax.text(x_cur + cw / 2, hdr_y - row_h / 2, hdr,
                            color=FSC_YELLOW, fontsize=7, fontweight="bold",
                            ha="center", va="center", transform=ax.transAxes)
                    x_cur += cw

                # Data rows
                for r_i, prog in enumerate(programs):
                    y   = hdr_y - (r_i + 1) * (row_h + 0.003) - 0.008
                    bg  = PALE_GREEN if r_i % 2 == 0 else "white"
                    x_cur = 0.0
                    for _, key, cw in col_defs:
                        ax.add_patch(mpatches.Rectangle(
                            (x_cur, y - row_h * 0.85), cw - 0.002, row_h,
                            facecolor=bg, linewidth=0,
                            transform=ax.transAxes, clip_on=False,
                        ))
                        raw     = prog.get(key, "")
                        val_str = str(raw)
                        color   = TEXT_DARK

                        # Value formatting
                        if key == "avg_los":
                            val_str = f"{raw}d"
                        elif key in ("perm_pct", "positive_pct"):
                            val_str = f"{raw}%"
                        elif key == "program":
                            val_str = _re.sub(
                                r"^[A-Z\-]+FSC:\s*|^FSC:\s*", "", str(raw)
                            )[:30]

                        # Colour coding
                        if key == "perm_pct" and isinstance(raw, (int, float)) and raw >= 30:
                            color = FSC_GREEN2
                        elif key == "positive_pct" and isinstance(raw, (int, float)) and raw >= 40:
                            color = FSC_GREEN2
                        elif key == "homeless_exits" and isinstance(raw, (int, float)) and raw > prog.get("perm_exits", 0):
                            color = "#dc3545"
                        elif key == "avg_cm_load" and isinstance(raw, (int, float)) and raw > 25:
                            color = "#fd7e14"
                        elif key == "zero_services" and isinstance(raw, int) and raw > 0:
                            color = "#dc3545"

                        ha     = "left"  if key == "program" else "center"
                        cell_x = x_cur + (0.006 if key == "program" else cw / 2)
                        ax.text(cell_x, y - row_h * 0.32, val_str,
                                color=color, fontsize=6.8,
                                ha=ha, va="center",
                                transform=ax.transAxes)
                        x_cur += cw

                pdf.savefig(fig, bbox_inches="tight")
                plt.close(fig)

        else:
            # ── Fallback: generic client-list table ────────────────────
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data
            drop_cols = [c for c in df.columns if c.startswith("_risk_")]
            df = df.drop(columns=drop_cols, errors="ignore")

            fig, ax = plt.subplots(
                figsize=(14, max(3, len(df) * 0.35 + 1.5))
            )
            ax.axis("off")
            ax.set_title("Client Report", fontsize=13, fontweight="bold", pad=12)
            tbl = ax.table(
                cellText=df.values, colLabels=df.columns,
                cellLoc="center", loc="center",
            )
            tbl.auto_set_font_size(False)
            tbl.set_fontsize(8)
            tbl.scale(1.1, 1.4)
            plt.tight_layout()
            with PdfPages(output) as pdf2:
                pdf2.savefig(fig, bbox_inches="tight")
            plt.close(fig)

    output.seek(0)
    filename = f"fsc_{report}_{today.isoformat()}.pdf"
    response = HttpResponse(output.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
