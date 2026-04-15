import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { canKpis, clientList, cmSummary, executiveKpis, programList, programSummary, serviceCounts } from "@/lib/metrics";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

function qp(url: string) {
  return new URL(url).searchParams;
}

function monthsFromRange(range: string | null): number {
  if (range === "1") return 1;
  if (range === "18") return 18;
  return 6;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = qp(req.url);
  const format = (params.get("format") ?? "excel").toLowerCase();
  const report = (params.get("report") ?? "clients").toLowerCase();

  const ds = await readCurrentDataset();
  if (!ds) {
    return NextResponse.json({ error: "no_data" }, { status: 400 });
  }

  const program = params.get("program");
  const range = params.get("range");
  const months = report === "executive" ? monthsFromRange(range) : null;

  if (format === "excel") {
    const wb = new ExcelJS.Workbook();

    if (report === "executive") {
      const kpis = executiveKpis(ds, program || null, months);
      const can = canKpis(ds, months);
      const programs = programSummary(ds, program || null, months);
      const svc = serviceCounts(ds, { months, program: program || null });

      const s1 = wb.addWorksheet("KPIs");
      s1.addRow(["metric", "value"]);
      for (const [k, v] of Object.entries(kpis)) {
        s1.addRow([k, String(v)]);
      }
      s1.addRow([]);
      s1.addRow(["CAN", ""]);
      for (const [k, v] of Object.entries(can)) {
        s1.addRow([k, String(v)]);
      }

      const s2 = wb.addWorksheet("Programs");
      s2.columns = [
        { header: "program", key: "program", width: 40 },
        { header: "active", key: "active", width: 10 },
        { header: "exits", key: "exits", width: 10 },
        { header: "perm_exits", key: "perm_exits", width: 12 },
        { header: "perm_pct", key: "perm_pct", width: 10 },
        { header: "positive_exits", key: "positive_exits", width: 14 },
        { header: "positive_pct", key: "positive_pct", width: 12 },
        { header: "homeless_exits", key: "homeless_exits", width: 14 },
        { header: "zero_services", key: "zero_services", width: 14 },
        { header: "avg_los", key: "avg_los", width: 10 },
        { header: "cms", key: "cms", width: 8 },
        { header: "avg_cm_load", key: "avg_cm_load", width: 12 },
      ];
      for (const row of programs) {
        s2.addRow(row);
      }

      const s3 = wb.addWorksheet("Services");
      s3.columns = [
        { header: "service", key: "name", width: 50 },
        { header: "count", key: "count", width: 12 },
        { header: "pct", key: "pct", width: 8 },
      ];
      for (const row of svc) {
        s3.addRow(row);
      }
    } else {
      const activeOnly = (params.get("active_only") ?? "1") === "1";
      const noServices = (params.get("no_services") ?? "0") === "1";
      const noRecent = (params.get("no_recent") ?? "0") === "1";
      const approaching = (params.get("approaching_60") ?? "0") === "1";

      const minDays = params.get("min_days") ? Number(params.get("min_days")) : null;
      const maxDays = params.get("max_days") ? Number(params.get("max_days")) : null;

      const rows = clientList(ds, {
        program: program || null,
        cm: params.get("cm"),
        risk: params.get("risk"),
        active_only: activeOnly,
        no_services: noServices,
        no_recent: noRecent,
        approaching_60: approaching,
        min_days: Number.isFinite(minDays) ? minDays : null,
        max_days: Number.isFinite(maxDays) ? maxDays : null,
      });

      const s = wb.addWorksheet("Clients");
      s.columns = [
        { header: "uid", key: "uid", width: 18 },
        { header: "program", key: "program", width: 30 },
        { header: "cm", key: "cm", width: 22 },
        { header: "days_in_program", key: "days_in_program", width: 14 },
        { header: "days_since_service", key: "days_since_service", width: 16 },
        { header: "services_count", key: "services_count", width: 14 },
        { header: "risk_level", key: "risk_level", width: 10 },
        { header: "risk_score", key: "risk_score", width: 10 },
        { header: "flags", key: "flags", width: 40 },
        { header: "exit_date", key: "exit_date", width: 12 },
        { header: "destination", key: "destination", width: 26 },
      ];
      for (const r of rows) {
        s.addRow({ ...r, flags: r.flags.join("; ") });
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `fsc_${report}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "pdf") {
    // Minimal PDF export (summary). Kept intentionally simple for serverless.
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]); // US Letter

    const title = report === "executive" ? "FSC Executive Export" : "FSC Client Export";
    page.drawText(title, { x: 50, y: 740, size: 18, font });

    const dsMeta = `Data uploaded: ${ds.meta.uploadedAt}`;
    page.drawText(dsMeta, { x: 50, y: 715, size: 10, font });

    if (report === "executive") {
      const kpis = executiveKpis(ds, program || null, months);
      let y = 680;
      for (const [k, v] of Object.entries(kpis)) {
        page.drawText(`${k}: ${v}`, { x: 50, y, size: 10, font });
        y -= 14;
        if (y < 60) break;
      }
    } else {
      const rows = clientList(ds, { active_only: true });
      page.drawText(`Clients (active only): ${rows.length}`, { x: 50, y: 680, size: 10, font });
    }

    const bytes = await pdf.save();
    const filename = `fsc_${report}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "unsupported_format" }, { status: 400 });
}
