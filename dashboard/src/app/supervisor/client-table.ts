import type { ClientEntry } from "./CmCardsGroup";

export type ClientStatusFilter = "all" | "active" | "exited";
export type ClientSortDirection = "asc" | "desc";
export type ClientSortKey =
  | "uid"
  | "days_in_program"
  | "days_since_real_service"
  | "services_count"
  | "attempted_engagements"
  | "appointment_reminders"
  | "risk_level"
  | "exit_date"
  | "destination"
  | "flags";

function sortValue(client: ClientEntry, key: ClientSortKey): string | number | null {
  switch (key) {
    case "risk_level":
      return client.risk_level === "High" ? 3
        : client.risk_level === "Medium" ? 2
        : client.risk_level === "Low" ? 1 : null;
    case "exit_date":
      return client.exit_date ? `Exited ${client.exit_date}` : "Active";
    case "flags":
      return client.flags.join(", ") || null;
    default:
      return client[key] === "" ? null : client[key];
  }
}

export function sortAndFilterClients(
  clients: ClientEntry[],
  status: ClientStatusFilter,
  key: ClientSortKey,
  direction: ClientSortDirection
): ClientEntry[] {
  return clients
    .filter((client) => status === "all" || (status === "exited" ? Boolean(client.exit_date) : !client.exit_date))
    .sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      const difference = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return direction === "asc" ? difference : -difference;
    });
}
