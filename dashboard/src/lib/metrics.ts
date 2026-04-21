import type { Dataset, Enrollment, ServiceEvent } from "@/lib/dataset";

export const CAN_IDENTIFIER = "CAN Team Outreach";

export const PROGRAM_ORDER = [
  "North A",
  "Grove",
  "Roseville Road",
  "Stockton Safe Stay",
  "CAN Team",
] as const;

export const DEFAULT_SERVICE_ITEMS = [
  "Primary Care Services",
  "Connect to a Primary Health Care Provider",
  "Assist with obtaining Prescribed Medications",
  "General Case Management",
  "Staff Transported",
  "Alcohol & Substance Use Disorder",
  "Provided AOD Services",
  "Linked to a CalAim provider",
  "Provided Bus Pass(es)",
  "Complete / Submit Housing Application(s)",
  "Connect to Mental Health Services",
  "Coordinate Care with Healthcare Providers",
  "Assist with obtaining Health Insurance",
] as const;

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function isYes(v: unknown): boolean {
  return String(v ?? "").toLowerCase() === "yes";
}

function isoToDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function windowStartForMonths(months: number): Date {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setMonth(d.getMonth() - (months - 1));
  d.setDate(1);
  return d;
}

function withinDateWindow(exitIso: string | undefined, months: number | null): boolean {
  if (!exitIso) return false;
  if (!months) return true;
  const exit = isoToDate(exitIso);
  if (!exit) return false;
  return exit >= windowStartForMonths(months);
}

export function programList(ds: Dataset): string[] {
  return Array.from(new Set(ds.enrollments.map((e) => e.Name).filter(Boolean))).sort();
}

export function cmList(ds: Dataset, program?: string | null): string[] {
  let rows = ds.enrollments;
  if (program) rows = rows.filter((e) => e.Name === program);
  return Array.from(
    new Set(rows.map((e) => e["Assigned Staff"]).filter((v): v is string => Boolean(v)))
  ).sort();
}

export function executiveKpis(ds: Dataset, program?: string | null, months?: number | null) {
  let rows = ds.enrollments;
  if (program) rows = rows.filter((e) => e.Name === program);

  // Exclude CAN team from housing KPIs
  rows = rows.filter((e) => !e.Name.toLowerCase().includes(CAN_IDENTIFIER.toLowerCase()));

  const active = rows.filter((e) => String(e["Active in Project"]) === "Yes");
  const exitedAll = rows.filter((e) => String(e["Active in Project"]) === "No");
  const exited = months ? exitedAll.filter((e) => withinDateWindow(e["Project Exit Date"], months)) : exitedAll;

  const totalActive = active.length;
  const totalExits = exited.length;

  const permExits = exited.filter((e) => e["Destination Category"] === "Permanent Housing Situations").length;
  const homelessExits = exited.filter((e) => e["Destination Category"] === "Homeless Situations").length;

  const longStay = active.filter((e) => (e["Days in Project"] ?? 0) >= 90).length;
  const approaching60 = active.filter((e) => {
    const d = e["Days in Project"] ?? 0;
    return d >= 45 && d <= 75;
  }).length;
  const zeroServices = active.filter((e) => (e.service_count ?? 0) === 0).length;
  const noRecentContact = active.filter((e) => e["Days Since Last Service"] === null || (e["Days Since Last Service"] ?? 0) > 21).length;

  const avgLos =
    active.length === 0
      ? 0
      : Math.round(
          (active.reduce((sum, e) => sum + (e["Days in Project"] ?? 0), 0) / active.length) * 10
        ) / 10;

  const cmCounts = new Map<string, number>();
  for (const e of active) {
    const cm = e["Assigned Staff"] ?? "(unassigned)";
    cmCounts.set(cm, (cmCounts.get(cm) ?? 0) + 1);
  }
  const loads = Array.from(cmCounts.values());
  const avgCmLoad = loads.length ? Math.round((loads.reduce((a, b) => a + b, 0) / loads.length) * 10) / 10 : 0;
  const maxCmLoad = loads.length ? Math.max(...loads) : 0;

  return {
    total_active: totalActive,
    total_exits: totalExits,
    perm_housing_exits: permExits,
    perm_housing_pct: pct(permExits, totalExits),
    homeless_exits: homelessExits,
    homeless_exit_pct: pct(homelessExits, totalExits),
    avg_length_of_stay: avgLos,
    long_stay_count: longStay,
    long_stay_pct: pct(longStay, totalActive),
    approaching_60_days: approaching60,
    zero_services_active: zeroServices,
    no_recent_contact: noRecentContact,
    avg_cm_load: avgCmLoad,
    max_cm_load: maxCmLoad,
  };
}

export function canKpis(ds: Dataset, months?: number | null) {
  const rows = ds.enrollments.filter((e) => e.Name.toLowerCase().includes(CAN_IDENTIFIER.toLowerCase()));
  const active = rows.filter((e) => String(e["Active in Project"]) === "Yes");
  const exitedAll = rows.filter((e) => String(e["Active in Project"]) === "No");
  const exited = months ? exitedAll.filter((e) => withinDateWindow(e["Project Exit Date"], months)) : exitedAll;

  const totalExits = exited.length;

  const exclude = /jail|prison|hospital/i;
  const shelter = /Emergency shelter|Safe Haven/i;

  let positive = 0;
  let perm = 0;
  let shelterConnected = 0;

  for (const e of exited) {
    const cat = e["Destination Category"] ?? "";
    const dest = String(e.Destination ?? "");
    const institutionalGood = cat === "Institutional Situations" && !exclude.test(dest);
    const shelterDest = shelter.test(dest);

    const pos =
      cat === "Permanent Housing Situations" ||
      cat === "Temporary Housing Situations" ||
      institutionalGood ||
      cat === "Other" ||
      (cat === "Homeless Situations" && shelterDest);

    if (pos) positive += 1;
    if (cat === "Permanent Housing Situations") perm += 1;
    if (cat === "Homeless Situations" && shelterDest) shelterConnected += 1;
  }

  return {
    active_navigations: active.length,
    total_exits: totalExits,
    positive_exits: positive,
    positive_pct: pct(positive, totalExits),
    perm_housing: perm,
    shelter_connected: shelterConnected,
  };
}

export function programSummary(ds: Dataset, program?: string | null, months?: number | null) {
  let rows = ds.enrollments;
  if (program) rows = rows.filter((e) => e.Name === program);

  const exclude = /jail|prison|hospital/i;
  const shelter = /Emergency shelter|Safe Haven/i;

  const byProg = new Map<string, Enrollment[]>();
  for (const e of rows) {
    byProg.set(e.Name, [...(byProg.get(e.Name) ?? []), e]);
  }

  const out: Array<Record<string, unknown>> = [];

  for (const [progName, group] of byProg.entries()) {
    const isCan = progName.toLowerCase().includes(CAN_IDENTIFIER.toLowerCase());
    const active = group.filter((e) => String(e["Active in Project"]) === "Yes");
    const exitedAll = group.filter((e) => String(e["Active in Project"]) === "No");
    const exited = months ? exitedAll.filter((e) => withinDateWindow(e["Project Exit Date"], months)) : exitedAll;

    const totalExits = exited.length;

    let perm = 0;
    let homeless = 0;
    let positive = 0;

    for (const e of exited) {
      const cat = e["Destination Category"] ?? "";
      const dest = String(e.Destination ?? "");
      const institutionalGood = cat === "Institutional Situations" && !exclude.test(dest);
      const basePos =
        cat === "Permanent Housing Situations" ||
        cat === "Temporary Housing Situations" ||
        institutionalGood;

      const canExtra = isCan && (cat === "Other" || (cat === "Homeless Situations" && shelter.test(dest)));

      if (cat === "Permanent Housing Situations") perm += 1;
      if (cat === "Homeless Situations") homeless += 1;
      if (basePos || canExtra) positive += 1;
    }

    const cms = new Set(active.map((e) => e["Assigned Staff"]).filter(Boolean)).size;
    const avgLoad = cms ? Math.round((active.length / cms) * 10) / 10 : 0;
    const avgLos = active.length ? Math.round((active.reduce((s, e) => s + (e["Days in Project"] ?? 0), 0) / active.length) * 10) / 10 : 0;

    out.push({
      program: progName,
      active: active.length,
      exits: totalExits,
      perm_exits: perm,
      perm_pct: pct(perm, totalExits),
      positive_exits: positive,
      positive_pct: pct(positive, totalExits),
      homeless_exits: homeless,
      zero_services: active.filter((e) => (e.service_count ?? 0) === 0).length,
      avg_los: avgLos,
      cms,
      avg_cm_load: avgLoad,
    });
  }

  return out.sort((a, b) => Number(b.active) - Number(a.active));
}

export interface CmSummaryEntry {
  cm: string;
  program: string;
  active_clients: number;
  total_exits: number;
  perm_exits: number;
  homeless_exits: number;
  services_logged: number;
  zero_services: number;
  no_recent_contact: number;
  high_risk_clients: number;
}

export function cmSummary(ds: Dataset, program?: string | null) {
  let rows = ds.enrollments;
  if (program) rows = rows.filter((e) => e.Name === program);

  const byCm = new Map<string, Enrollment[]>();
  for (const e of rows) {
    const cm = e["Assigned Staff"] ?? "(unassigned)";
    byCm.set(cm, [...(byCm.get(cm) ?? []), e]);
  }

  const out: CmSummaryEntry[] = [];
  for (const [cm, group] of byCm.entries()) {
    const active = group.filter((e) => String(e["Active in Project"]) === "Yes");
    const exited = group.filter((e) => String(e["Active in Project"]) === "No");

    const perm = exited.filter((e) => e["Destination Category"] === "Permanent Housing Situations").length;
    const homeless = exited.filter((e) => e["Destination Category"] === "Homeless Situations").length;
    const highRisk = active.filter((e) => e["Risk Level"] === "High").length;
    const noRecent = active.filter((e) => e["Days Since Last Service"] === null || (e["Days Since Last Service"] ?? 0) > 21).length;
    const zeroSvc = active.filter((e) => (e.service_count ?? 0) === 0).length;

    out.push({
      cm,
      program: program ? program : "Multiple",
      active_clients: active.length,
      total_exits: exited.length,
      perm_exits: perm,
      homeless_exits: homeless,
      services_logged: active.reduce((s, e) => s + (e.service_count ?? 0), 0),
      zero_services: zeroSvc,
      no_recent_contact: noRecent,
      high_risk_clients: highRisk,
    });
  }

  return out.sort((a, b) => Number(b.active_clients) - Number(a.active_clients));
}

export function clientList(
  ds: Dataset,
  filters: {
    program?: string | null;
    cm?: string | null;
    risk?: string | null;
    active_only?: boolean;
    no_services?: boolean;
    no_recent?: boolean;
    approaching_60?: boolean;
    min_days?: number | null;
    max_days?: number | null;
  }
) {
  let rows = ds.enrollments;

  if (filters.program) rows = rows.filter((e) => e.Name === filters.program);
  if (filters.cm) rows = rows.filter((e) => e["Assigned Staff"] === filters.cm);
  if (filters.active_only) rows = rows.filter((e) => String(e["Active in Project"]) === "Yes");
  if (filters.risk) rows = rows.filter((e) => e["Risk Level"] === filters.risk);

  if (filters.min_days != null) rows = rows.filter((e) => (e["Days in Project"] ?? 0) >= filters.min_days!);
  if (filters.max_days != null) rows = rows.filter((e) => (e["Days in Project"] ?? 0) <= filters.max_days!);
  if (filters.no_services) rows = rows.filter((e) => (e.service_count ?? 0) === 0);
  if (filters.no_recent) rows = rows.filter((e) => (e["Days Since Last Service"] ?? 0) > 21);
  if (filters.approaching_60) rows = rows.filter((e) => {
    const d = e["Days in Project"] ?? 0;
    return d >= 45 && d <= 75;
  });

  const out = rows.map((row) => {
    const flags: string[] = [];
    if (isYes(row["Mental Health"])) flags.push("Mental Health");

    const sub = String(row["Substance Use Disorder"] ?? "");
    if (sub && sub !== "No" && sub !== "nan") flags.push("Substance Use");

    if (isYes(row["Chronic Health"])) flags.push("Chronic Health");
    if (isYes(row.Developmental)) flags.push("Developmental");
    if (String(row["General Health Status"] ?? "") === "Poor") flags.push("Poor Health");
    if ((row.service_count ?? 1) === 0) flags.push("No Services");

    const daysSince = row["Days Since Last Service"];
    if (daysSince === null || (typeof daysSince === "number" && daysSince > 21)) {
      flags.push("No Recent Contact");
    }

    if ((row["Days in Project"] ?? 0) >= 60) flags.push("Long Stay");

    return {
      uid: row.uid,
      program: row.Name,
      cm: row["Assigned Staff"] ?? "",
      days_in_program: row["Days in Project"] ?? null,
      days_since_service: daysSince ?? null,
      services_count: row.service_count ?? 0,
      risk_level: String(row["Risk Level"] ?? ""),
      risk_score: Number(row["Risk Score"] ?? 0),
      flags,
      destination: row["Destination Category"] ?? "",
      exit_date: row["Project Exit Date"] ?? "",
      cash_income: row["Cash Income Amount"] ?? null,
      general_health: row["General Health Status"] ?? "",
    };
  });

  return out.sort((a, b) => b.risk_score - a.risk_score);
}

export function serviceCounts(
  ds: Dataset,
  opts: { items?: string[] | null; months?: number | null; program?: string | null }
) {
  let svc: ServiceEvent[] = ds.services;
  if (opts.program) svc = svc.filter((s) => s.Name === opts.program);

  if (opts.months) {
    const start = windowStartForMonths(opts.months);
    svc = svc.filter((s) => {
      const d = isoToDate(s["Service Attendance Date"]);
      return d ? d >= start : false;
    });
  }

  const items = opts.items && opts.items.length ? opts.items : [...DEFAULT_SERVICE_ITEMS];

  const rows = items.map((name) => {
    const count = svc
      .filter((s) => s["Service Item Name"] === name)
      .reduce((sum, s) => sum + (s.Count ?? 0), 0);
    return { name, count };
  });

  rows.sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }));
}
