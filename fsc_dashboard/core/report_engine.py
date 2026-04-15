"""
Report engine — pure pandas + matplotlib, no Django dependencies.

Shared by both generate_report.py (standalone CLI) and core/views.py
(Django download view) so the figure code lives in exactly one place.
"""

from __future__ import annotations

import datetime
import io
import re
from pathlib import Path
from typing import Optional

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — safe for both CLI and Django

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
import pandas as pd

# ── Brand palette ─────────────────────────────────────────────────────────────
FOREST_GREEN   = "#228B22"
EASTER_YELLOW  = "#F9E44B"
MID_GREEN      = "#52BE80"
LIGHT_GREEN    = "#A9DFBF"
WHITE          = "#FFFFFF"
OFF_WHITE      = "#F8F9F0"
DARK_GRAY      = "#333333"
MID_GRAY       = "#888888"
RULE_COLOR     = "#DDDDDD"

BAR_COLORS = {
    "permanent":     FOREST_GREEN,
    "temporary":     MID_GREEN,
    "institutional": LIGHT_GREEN,
}

# Destinations that disqualify an "Institutional Situations" exit from being
# counted as a positive outcome.
_EXCLUDE_PATTERN = re.compile(r"jail|prison|hospital", re.IGNORECASE)

# ── Data computation ──────────────────────────────────────────────────────────

def compute_positive_outcomes(
    df: pd.DataFrame,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """
    Return distinct positive-outcome counts, overall and per program.

    Positive outcome = exit to:
      • Permanent Housing Situations  — all
      • Temporary Housing Situations  — all
      • Institutional Situations      — excluding jail, prison, and hospital

    Uniqueness is determined by 'Unique Identifier' within each program.

    Parameters
    ----------
    df : cleaned DataFrame from core.loader.load_dataframe()
    start_date, end_date : optional ISO-format date strings (YYYY-MM-DD)

    Returns
    -------
    {
        "overall": {"permanent": int, "temporary": int, "institutional": int,
                    "total_positive": int, "total_exits": int},
        "by_program": {
            "<program name>": {"permanent": int, "temporary": int,
                               "institutional": int, "total": int,
                               "total_exits": int},
            ...
        },
        "date_label": str,   # human-readable range string
        "start_date": str | None,
        "end_date":   str | None,
    }
    """
    # Exits only (Project Exit Date populated)
    exited = df[df["Project Exit Date"].notna()].copy()

    # Date-range filter
    if start_date:
        exited = exited[exited["Project Exit Date"] >= pd.Timestamp(start_date)]
    if end_date:
        exited = exited[exited["Project Exit Date"] <= pd.Timestamp(end_date)]

    # Classify each row
    exited["_perm"] = exited["Destination Category"] == "Permanent Housing Situations"
    exited["_temp"] = exited["Destination Category"] == "Temporary Housing Situations"
    exited["_inst"] = (
        (exited["Destination Category"] == "Institutional Situations")
        & ~exited["Destination"].fillna("").str.contains(_EXCLUDE_PATTERN)
    )
    exited["_positive"] = exited["_perm"] | exited["_temp"] | exited["_inst"]

    # Overall distinct counts
    uid = "Unique Identifier"
    overall = {
        "permanent":      int(exited.loc[exited["_perm"], uid].nunique()),
        "temporary":      int(exited.loc[exited["_temp"], uid].nunique()),
        "institutional":  int(exited.loc[exited["_inst"], uid].nunique()),
        "total_positive": int(exited.loc[exited["_positive"], uid].nunique()),
        "total_exits":    int(exited[uid].nunique()),
    }

    # Per-program breakdown
    by_program: dict[str, dict] = {}
    for program, grp in exited.groupby("Name"):
        by_program[str(program)] = {
            "permanent":     int(grp.loc[grp["_perm"], uid].nunique()),
            "temporary":     int(grp.loc[grp["_temp"], uid].nunique()),
            "institutional": int(grp.loc[grp["_inst"], uid].nunique()),
            "total":         int(grp.loc[grp["_positive"], uid].nunique()),
            "total_exits":   int(grp[uid].nunique()),
        }

    # Build a human-readable date label
    if start_date and end_date:
        date_label = f"{_fmt_date(start_date)} – {_fmt_date(end_date)}"
    elif start_date:
        date_label = f"From {_fmt_date(start_date)}"
    elif end_date:
        date_label = f"Through {_fmt_date(end_date)}"
    else:
        date_label = "All Available Data"

    return {
        "overall":    overall,
        "by_program": by_program,
        "date_label": date_label,
        "start_date": start_date,
        "end_date":   end_date,
    }


def _fmt_date(iso: str) -> str:
    try:
        return datetime.date.fromisoformat(iso).strftime("%B %-d, %Y")
    except (ValueError, AttributeError):
        # %-d not available on Windows — use %d with lstrip
        return datetime.date.fromisoformat(iso).strftime("%B %d, %Y").replace(" 0", " ")


# ── Figure builder ────────────────────────────────────────────────────────────

def build_report_figure(
    outcomes: dict,
    logo_path: Optional[str | Path] = None,
) -> plt.Figure:
    """
    Build and return an 8.5 × 11 inch matplotlib Figure.

    Parameters
    ----------
    outcomes  : dict returned by compute_positive_outcomes()
    logo_path : optional path to fsc_logo.avif (or any PIL-readable image)
    """
    logo_arr = _load_logo(logo_path)

    fig = plt.figure(figsize=(8.5, 11), dpi=150)
    fig.patch.set_facecolor(WHITE)

    gs = gridspec.GridSpec(
        nrows=5, ncols=4,
        figure=fig,
        height_ratios=[1.35, 0.85, 2.9, 2.7, 0.35],
        hspace=0.55,
        wspace=0.35,
        top=0.975, bottom=0.025,
        left=0.075, right=0.965,
    )

    # ── Row 0 : Header ────────────────────────────────────────────────────────
    ax_hdr = fig.add_subplot(gs[0, :])
    _draw_header(ax_hdr, outcomes["date_label"], logo_arr)

    # ── Row 1 : KPI tiles ─────────────────────────────────────────────────────
    ov = outcomes["overall"]
    kpi_specs = [
        ("PERMANENT\nHOUSING EXITS",     ov["permanent"],      "distinct clients"),
        ("TEMPORARY\nHOUSING EXITS",     ov["temporary"],      "distinct clients"),
        ("INSTITUTIONAL\nEXITS (POS.)",  ov["institutional"],  "excl. jail/hospital"),
        ("TOTAL POSITIVE\nOUTCOMES",     ov["total_positive"], "unique clients"),
    ]
    for col, (label, value, sub) in enumerate(kpi_specs):
        ax_k = fig.add_subplot(gs[1, col])
        _draw_kpi(ax_k, label, value, sub,
                  bg=EASTER_YELLOW, fg=FOREST_GREEN,
                  highlight=(col == 3))

    # ── Row 2 : Grouped bar chart — per-program breakdown ─────────────────────
    ax_grouped = fig.add_subplot(gs[2, :])
    _draw_grouped_bars(ax_grouped, outcomes["by_program"])

    # ── Row 3 : Horizontal bar — programs ranked by total positive ────────────
    ax_hbar = fig.add_subplot(gs[3, :])
    _draw_hbar(ax_hbar, outcomes["by_program"])

    # ── Row 4 : Footer ────────────────────────────────────────────────────────
    ax_ftr = fig.add_subplot(gs[4, :])
    _draw_footer(ax_ftr, outcomes["date_label"])

    return fig


def figure_to_bytes(fig: plt.Figure, fmt: str = "pdf") -> bytes:
    """Render a figure to raw bytes in the requested format."""
    buf = io.BytesIO()
    fig.savefig(buf, format=fmt, bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── Private drawing helpers ───────────────────────────────────────────────────

def _load_logo(logo_path) -> Optional[np.ndarray]:
    if logo_path is None:
        return None
    try:
        from PIL import Image
        img = Image.open(logo_path).convert("RGBA")
        return np.array(img)
    except Exception:
        return None


def _clear_axes(ax, facecolor=WHITE):
    ax.set_facecolor(facecolor)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks([])
    ax.set_yticks([])


def _draw_header(ax, date_label: str, logo_arr):
    _clear_axes(ax, facecolor=FOREST_GREEN)

    # Logo inset on the left
    if logo_arr is not None:
        logo_ax = ax.inset_axes([0.01, 0.08, 0.12, 0.85])
        logo_ax.imshow(logo_arr)
        logo_ax.axis("off")
        title_x = 0.54
    else:
        title_x = 0.50

    ax.text(
        title_x, 0.72, "FIRST STEP COMMUNITIES",
        ha="center", va="center",
        fontsize=21, fontweight="bold", color=WHITE,
        transform=ax.transAxes,
    )
    ax.text(
        title_x, 0.42, "Executive Housing Outcomes Report",
        ha="center", va="center",
        fontsize=13, color=WHITE, alpha=0.92,
        transform=ax.transAxes,
    )
    ax.text(
        title_x, 0.16, date_label,
        ha="center", va="center",
        fontsize=10, color=EASTER_YELLOW, fontweight="bold",
        transform=ax.transAxes,
    )


def _draw_kpi(ax, label: str, value: int, subtitle: str,
              bg: str, fg: str, highlight: bool = False):
    _clear_axes(ax, facecolor=bg)

    # Slightly darker border for "Total" tile
    if highlight:
        for spine in ax.spines.values():
            spine.set_visible(True)
            spine.set_color(FOREST_GREEN)
            spine.set_linewidth(2.0)

    ax.text(0.50, 0.80, label,
            ha="center", va="center",
            fontsize=7.5, fontweight="bold", color=fg,
            transform=ax.transAxes, linespacing=1.4)
    ax.text(0.50, 0.47, f"{value:,}",
            ha="center", va="center",
            fontsize=30, fontweight="bold", color=fg,
            transform=ax.transAxes)
    ax.text(0.50, 0.14, subtitle,
            ha="center", va="center",
            fontsize=7, color=fg, alpha=0.7,
            transform=ax.transAxes)


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _draw_grouped_bars(ax, by_program: dict):
    # Sort programs by total descending
    programs = sorted(by_program, key=lambda p: by_program[p]["total"], reverse=True)
    if not programs:
        _clear_axes(ax)
        ax.text(0.5, 0.5, "No exit data for selected period.",
                ha="center", va="center", transform=ax.transAxes)
        return

    x = np.arange(len(programs))
    width = 0.24
    offsets = [-width, 0, width]
    keys    = ["permanent", "temporary", "institutional"]
    labels  = ["Permanent Housing", "Temporary Housing", "Institutional (Pos.)"]
    colors  = [FOREST_GREEN, MID_GREEN, LIGHT_GREEN]

    ax.set_facecolor(OFF_WHITE)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.yaxis.grid(True, color=RULE_COLOR, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)

    for offset, key, label, color in zip(offsets, keys, labels, colors):
        vals = [by_program[p][key] for p in programs]
        bars = ax.bar(x + offset, vals, width, label=label,
                      color=color, edgecolor=WHITE, linewidth=0.6, zorder=3)
        # Value labels above non-zero bars
        for bar, v in zip(bars, vals):
            if v > 0:
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 0.15,
                    str(v),
                    ha="center", va="bottom",
                    fontsize=6.5, fontweight="bold", color=DARK_GRAY,
                )

    ax.set_xticks(x)
    ax.set_xticklabels(
        [_truncate(p, 18) for p in programs],
        rotation=15, ha="right", fontsize=7.5,
    )
    ax.tick_params(axis="y", labelsize=7.5, colors=DARK_GRAY)
    ax.tick_params(axis="x", colors=DARK_GRAY, length=0)
    ax.set_ylabel("Distinct Clients", fontsize=8, color=DARK_GRAY)
    ax.set_title(
        "Positive Housing Outcomes by Program & Destination Type",
        fontsize=10, fontweight="bold", color=DARK_GRAY, pad=6,
    )

    legend = ax.legend(
        handles=[
            mpatches.Patch(color=c, label=l)
            for c, l in zip(colors, labels)
        ],
        fontsize=7.5, loc="upper right",
        framealpha=0.85, edgecolor=RULE_COLOR,
    )
    legend.get_frame().set_facecolor(WHITE)


def _draw_hbar(ax, by_program: dict):
    # Sort ascending (bottom = lowest) so highest is at top
    programs = sorted(by_program, key=lambda p: by_program[p]["total"])
    if not programs:
        _clear_axes(ax)
        return

    totals  = [by_program[p]["total"] for p in programs]
    n       = len(programs)
    colors  = [EASTER_YELLOW if i == n - 1 else FOREST_GREEN for i in range(n)]

    ax.set_facecolor(OFF_WHITE)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.xaxis.grid(True, color=RULE_COLOR, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)

    bars = ax.barh(range(n), totals, color=colors,
                   edgecolor=WHITE, linewidth=0.6, height=0.6, zorder=3)

    # Value labels to the right of each bar
    max_val = max(totals) if totals else 1
    for i, (bar, v) in enumerate(zip(bars, totals)):
        ax.text(
            v + max_val * 0.012, i, f"{v:,}",
            va="center", fontsize=8,
            fontweight="bold" if i == n - 1 else "normal",
            color=DARK_GRAY,
        )

    ax.set_yticks(range(n))
    ax.set_yticklabels([_truncate(p, 28) for p in programs], fontsize=8, color=DARK_GRAY)
    ax.tick_params(axis="x", labelsize=7.5, colors=DARK_GRAY, length=0)
    ax.set_xlabel("Total Distinct Clients → Positive Outcomes", fontsize=8, color=DARK_GRAY)
    ax.set_title(
        "Programs Ranked by Total Positive Outcomes  ★ = Top Performer",
        fontsize=10, fontweight="bold", color=DARK_GRAY, pad=6,
    )
    ax.set_xlim(0, max_val * 1.15)


def _draw_footer(ax, date_label: str):
    _clear_axes(ax, facecolor=WHITE)

    # Thin rule line at top of footer
    ax.axhline(y=0.85, xmin=0, xmax=1,
               color=FOREST_GREEN, linewidth=1.2, alpha=0.5)

    generated = datetime.date.today().strftime("%B %d, %Y").replace(" 0", " ")
    text = (
        f"Generated: {generated}    |    "
        "Data Source: HMIS / ServicePoint SUP2    |    "
        "First Step Communities    |    "
        "Positive Outcomes include Permanent, Temporary, and Institutional exits "
        "(excluding jail, prison, and hospital)."
    )
    ax.text(0.50, 0.35, text,
            ha="center", va="center",
            fontsize=6, color=MID_GRAY, style="italic",
            transform=ax.transAxes, wrap=True)
