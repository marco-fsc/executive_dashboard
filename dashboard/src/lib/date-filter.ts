import type { ISODateString } from "@/lib/dataset";

export interface DateFilterSpec {
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
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

export function resolveExecutiveDateFilter(input: {
  startDate?: string | null;
  endDate?: string | null;
}): DateFilterSpec {
  const startDate = normalizeDateInput(input.startDate);
  const endDate = normalizeDateInput(input.endDate);

  return {
    startDate,
    endDate,
  };
}