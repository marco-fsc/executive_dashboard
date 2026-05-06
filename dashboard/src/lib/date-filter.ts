import type { ISODateString } from "@/lib/dataset";

export interface DateFilterSpec {
  months?: number | null;
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
}

export interface ExecutiveDateFilter extends DateFilterSpec {
  dateMode: "preset" | "custom";
  range: string;
}

function normalizeDateInput(value: string | null | undefined): ISODateString | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function monthsFromRange(range: string | null | undefined): number {
  if (range === "1") return 1;
  if (range === "18") return 18;
  return 6;
}

export function resolveExecutiveDateFilter(input: {
  dateMode?: string | null;
  range?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): ExecutiveDateFilter {
  const range = input.range ?? "6";
  const startDate = normalizeDateInput(input.startDate);
  const endDate = normalizeDateInput(input.endDate);
  const wantsCustom = input.dateMode === "custom";

  if (wantsCustom && (startDate || endDate)) {
    return {
      dateMode: "custom",
      range,
      months: null,
      startDate,
      endDate,
    };
  }

  return {
    dateMode: wantsCustom ? "custom" : "preset",
    range,
    months: monthsFromRange(range),
    startDate,
    endDate,
  };
}