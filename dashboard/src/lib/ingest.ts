import crypto from "node:crypto";
import Papa from "papaparse";

import type { Dataset, Enrollment, ISODateString, ServiceEvent } from "@/lib/dataset";

const SUBSTANCE_USE_COLS = new Set([
  "Drug use disorder",
  "Alcohol use disorder",
  "Both alcohol and drug use disorders",
]);

function toISODate(value: unknown): ISODateString | "" {
  if (typeof value !== "string" || value.trim() === "") return "";
  // Handles values like "2026-04-06" or "4/6/2026".
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseCashIncome(row: Record<string, unknown>): number | null {
  const raw =
    (row["Total Cash Income.1"] ?? row["Total Cash Income"]) as unknown;
  if (raw === undefined || raw === null) return null;
  const s = String(raw).replace(/[$,]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function hmacUid(rawUid: unknown): string {
  const salt = process.env.INGEST_SALT;
  if (!salt) {
    throw new Error("Missing INGEST_SALT env var (required to hash client identifiers). ");
  }
  const msg = String(rawUid ?? "");
  return crypto.createHmac("sha256", salt).update(msg).digest("hex").slice(0, 16);
}

function cleanRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k ?? "").trim();
    if (!key || key.startsWith("Unnamed")) continue;
    out[key] = v;
  }
  return out;
}

export function buildDatasetFromRawCsv(csvText: string, sourceFilename?: string): Dataset {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => String(h ?? "").trim(),
  });

  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message}`);
  }

  const rawRows = (parsed.data ?? []).map(cleanRowKeys);

  const services: ServiceEvent[] = [];

  type TmpEnrollment = Enrollment & {
    _snapshotSvcDate?: ISODateString;
  };

  const enrollmentsByKey = new Map<string, TmpEnrollment>();
  const svcAggByKey = new Map<string, { count: number; lastDate: ISODateString | "" }>();

  for (const raw of rawRows) {
    const program = String(raw["Name"] ?? "").trim();
    const start = toISODate(raw["Project Start Date"]);
    if (!program || !start) continue;

    const uidHash = hmacUid(raw["Unique Identifier"]);
    const key = `${uidHash}|${program}|${start}`;

    const svcDate =
      toISODate(raw["Service Attendance Date"]) ||
      toISODate(raw["Last Attendance Date"]) ||
      toISODate(raw["Last Start Date"]);

    const svcItem = String(raw["Service Item Name"] ?? "").trim();
    const countRaw = raw["Count"];
    const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 1;

    if (svcDate && svcItem) {
      services.push({
        uid_hash: uidHash,
        Name: program,
        "Project Start Date": start,
        "Service Item Name": svcItem,
        "Service Attendance Date": svcDate,
        Count: count,
      });
    }

    const agg = svcAggByKey.get(key) ?? { count: 0, lastDate: "" as const };
    agg.count += 1;
    if (svcDate && (!agg.lastDate || svcDate > agg.lastDate)) {
      agg.lastDate = svcDate;
    }
    svcAggByKey.set(key, agg);

    const snapshot = enrollmentsByKey.get(key);
    const shouldReplaceSnapshot =
      !snapshot ||
      (svcDate && (!snapshot._snapshotSvcDate || svcDate > snapshot._snapshotSvcDate));

    if (shouldReplaceSnapshot) {
      const daysInProject = Number(raw["Days in Project"]);
      enrollmentsByKey.set(key, {
        uid_hash: uidHash,
        Name: program,
        "Project Start Date": start,
        "Project Exit Date": toISODate(raw["Project Exit Date"]) || undefined,
        "Active in Project": String(raw["Active in Project"] ?? ""),
        "Assigned Staff": String(raw["Assigned Staff"] ?? "") || undefined,
        "Destination Category": String(raw["Destination Category"] ?? "") || undefined,
        Destination: String(raw["Destination"] ?? "") || undefined,
        "Days in Project": Number.isFinite(daysInProject) ? daysInProject : undefined,
        "Mental Health": String(raw["Mental Health"] ?? "") || undefined,
        "Chronic Health": String(raw["Chronic Health"] ?? "") || undefined,
        Developmental: String(raw["Developmental"] ?? "") || undefined,
        Physical: String(raw["Physical"] ?? "") || undefined,
        "Substance Use Disorder": String(raw["Substance Use Disorder"] ?? "") || undefined,
        "General Health Status": String(raw["General Health Status"] ?? "") || undefined,
        "Cash Income Amount": parseCashIncome(raw),
        _snapshotSvcDate: svcDate || undefined,
      });
    }
  }

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const enrollments: Enrollment[] = [];
  for (const [key, e] of enrollmentsByKey.entries()) {
    const agg = svcAggByKey.get(key);
    const lastDate = agg?.lastDate || "";
    const serviceCount = agg?.count ?? 0;

    const daysSince = lastDate ? daysBetween(lastDate, todayISO) : null;

    const hasSubstance = SUBSTANCE_USE_COLS.has(String(e["Substance Use Disorder"] ?? ""));

    const riskMental = String(e["Mental Health"] ?? "").toLowerCase() === "yes";
    const riskChronic = String(e["Chronic Health"] ?? "").toLowerCase() === "yes";
    const riskDev = String(e.Developmental ?? "").toLowerCase() === "yes";
    const riskPoorHealth = String(e["General Health Status"] ?? "").toLowerCase() === "poor";
    const riskNoServices = serviceCount === 0;
    const riskNoRecent = daysSince === null || daysSince > 21;
    const riskLongStay = (e["Days in Project"] ?? 0) >= 60 && String(e["Active in Project"]) === "Yes";

    const riskScore =
      (riskMental ? 1 : 0) +
      (hasSubstance ? 1 : 0) +
      (riskChronic ? 1 : 0) +
      (riskDev ? 1 : 0) +
      (riskPoorHealth ? 1 : 0) +
      (riskNoServices ? 1 : 0) +
      (riskNoRecent ? 1 : 0) +
      (riskLongStay ? 1 : 0);

    const riskLevel = riskScore <= 1 ? "Low" : riskScore <= 3 ? "Medium" : "High";

    const cleaned: Enrollment = { ...e };
    delete (cleaned as unknown as { _snapshotSvcDate?: unknown })._snapshotSvcDate;

    cleaned.last_service_date = lastDate || undefined;
    cleaned.service_count = serviceCount;
    cleaned["Days Since Last Service"] = daysSince;
    cleaned["Risk Score"] = riskScore;
    cleaned["Risk Level"] = riskLevel;

    enrollments.push(cleaned);
  }

  return {
    version: 1,
    meta: {
      uploadedAt: new Date().toISOString(),
      sourceFilename,
      rawRows: rawRows.length,
    },
    enrollments,
    services,
  };
}
