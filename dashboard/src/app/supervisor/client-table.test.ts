import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientEntry } from "./CmCardsGroup";
import { sortAndFilterClients } from "./client-table";
import type { ClientSortKey } from "./client-table";

function client(overrides: Partial<ClientEntry> = {}): ClientEntry {
  return {
    uid: "test-client", program: "Test Program", cm: "Test Manager",
    days_in_program: 10, days_since_service: 4, days_since_real_service: 4,
    services_count: 2, attempted_engagements: 0, appointment_reminders: 0,
    risk_level: "Low", risk_score: 1, flags: [], destination: "", exit_date: "",
    enrollment_date: "2026-10-01", cash_income: null, general_health: "",
    mental_health: "", chronic_health: "", developmental: "", physical: "",
    substance_use: "", medicare: "", hours_worked_last_week: "",
    employment_seeking: "", employment_tenure: "",
    ...overrides,
  };
}

test("status filters keep current and exited enrollments of the same client distinct", () => {
  const active = client();
  const exited = client({ enrollment_date: "2025-01-01", exit_date: "2026-03-17", days_in_program: 432 });
  const rows = [active, exited];
  assert.deepEqual(sortAndFilterClients(rows, "active", "days_in_program", "desc"), [active]);
  assert.deepEqual(sortAndFilterClients(rows, "exited", "days_in_program", "desc"), [exited]);
  assert.deepEqual(sortAndFilterClients(rows, "all", "days_in_program", "desc"), [exited, active]);
  assert.deepEqual(rows, [active, exited]);
});

const sortCases: Array<{ key: ClientSortKey; low: Partial<ClientEntry>; high: Partial<ClientEntry> }> = [
  { key: "uid", low: { uid: "A" }, high: { uid: "B" } },
  { key: "days_in_program", low: { days_in_program: 2 }, high: { days_in_program: 10 } },
  { key: "days_since_real_service", low: { days_since_real_service: 2 }, high: { days_since_real_service: 100 } },
  { key: "services_count", low: { services_count: 2 }, high: { services_count: 10 } },
  { key: "attempted_engagements", low: { attempted_engagements: 2 }, high: { attempted_engagements: 10 } },
  { key: "appointment_reminders", low: { appointment_reminders: 2 }, high: { appointment_reminders: 10 } },
  { key: "risk_level", low: { risk_level: "Medium" }, high: { risk_level: "High" } },
  { key: "exit_date", low: { exit_date: "" }, high: { exit_date: "2026-03-17" } },
  { key: "destination", low: { destination: "Apartment" }, high: { destination: "Shelter" } },
  { key: "flags", low: { flags: ["Chronic Health"] }, high: { flags: ["Long Stay"] } },
];

for (const { key, low, high } of sortCases) {
  test(`${key} sorts in both directions without mutating input`, () => {
    const first = client(low);
    const second = client(high);
    const rows = [second, first];
    assert.deepEqual(sortAndFilterClients(rows, "all", key, "asc"), [first, second]);
    assert.deepEqual(sortAndFilterClients(rows, "all", key, "desc"), [second, first]);
    assert.deepEqual(rows, [second, first]);
  });
}

test("missing values sort last in either direction, without treating zero as missing", () => {
  const missing = client({ days_since_real_service: null });
  const zero = client({ days_since_real_service: 0 });
  const older = client({ days_since_real_service: 238 });
  assert.deepEqual(sortAndFilterClients([missing, older, zero], "all", "days_since_real_service", "asc"), [zero, older, missing]);
  assert.deepEqual(sortAndFilterClients([missing, older, zero], "all", "days_since_real_service", "desc"), [older, zero, missing]);
});

test("filtering combines with sorting and handles empty results", () => {
  const first = client({ services_count: 1 });
  const second = client({ uid: "second-client", services_count: 5 });
  const exited = client({ exit_date: "2026-03-17", services_count: 10 });
  assert.deepEqual(sortAndFilterClients([first, exited, second], "active", "services_count", "desc"), [second, first]);
  assert.deepEqual(sortAndFilterClients([first], "exited", "uid", "asc"), []);
  assert.deepEqual(sortAndFilterClients([], "all", "uid", "asc"), []);
});
