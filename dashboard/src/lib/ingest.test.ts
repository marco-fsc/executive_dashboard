import assert from "node:assert/strict";
import { test } from "node:test";
import Papa from "papaparse";
import { buildDatasetFromRawCsv } from "./ingest";
import { clientList } from "./metrics";

function buildRows(rows: Array<Record<string, string>>) {
  return buildDatasetFromRawCsv(Papa.unparse(rows.map((row) => ({
    "Unique Identifier": "test-client",
    Name: "Test Program",
    "Project Start Date": "2026-09-10",
    "Project Exit Date": "2026-09-30",
    "Enrollment Exit Date": "",
    "Active in Project": "No",
    "Service Item Name": "General Case Management",
    "Service Attendance Date": "",
    "Last Start Date": "",
    "Assigned Staff": "Valid snapshot",
    Count: "1",
    ...row,
  }))));
}

test("service attendance must fall within inclusive enrollment dates", () => {
  const dataset = buildRows([
    { "Service Attendance Date": "2026-09-09" },
    { "Service Attendance Date": "2026-09-10" },
    { "Service Attendance Date": "2026-09-15" },
    { "Service Attendance Date": "2026-09-30" },
    { "Service Attendance Date": "2026-10-01", "Assigned Staff": "Out-of-range snapshot" },
  ]);
  assert.deepEqual(dataset.services.map((service) => service["Service Attendance Date"]), [
    "2026-09-10", "2026-09-15", "2026-09-30",
  ]);
  assert.equal(dataset.enrollments[0].service_count, 3);
  assert.equal(dataset.enrollments[0].last_service_date, "2026-09-30");
  assert.equal(dataset.enrollments[0].last_real_service_date, "2026-09-30");
  assert.equal(dataset.enrollments[0]["Assigned Staff"], "Valid snapshot");
  assert.equal(dataset.meta.rawRows, 5);
});

test("an enrollment without an exit date has no upper service-date limit", () => {
  const dataset = buildRows([
    { "Project Exit Date": "", "Service Attendance Date": "2026-09-09" },
    { "Project Exit Date": "", "Service Attendance Date": "2027-01-15" },
  ]);
  assert.equal(dataset.services.length, 1);
  assert.equal(dataset.services[0]["Service Attendance Date"], "2027-01-15");
  assert.equal(dataset.enrollments[0].service_count, 1);
});

test("enrollment exit takes precedence, with project exit as the blank-value fallback", () => {
  const dataset = buildRows([
    { "Enrollment Exit Date": "2026-09-20", "Service Attendance Date": "2026-09-20" },
    { "Enrollment Exit Date": "2026-09-20", "Service Attendance Date": "2026-09-21" },
    { "Unique Identifier": "fallback-client", "Service Attendance Date": "2026-09-30" },
    { "Unique Identifier": "fallback-client", "Service Attendance Date": "2026-10-01" },
  ]);
  assert.equal(dataset.services.length, 2);
  assert.deepEqual(dataset.enrollments.map((enrollment) => enrollment.service_count), [1, 1]);
});

test("repeated service rows outside an older enrollment are ignored without losing the enrollment", () => {
  const dataset = buildRows([
    {
      "Project Start Date": "2025-05-02",
      "Project Exit Date": "2025-09-19",
      "Service Attendance Date": "2026-09-15",
    },
    {
      "Project Start Date": "2026-07-27",
      "Project Exit Date": "2026-10-01",
      "Service Attendance Date": "2026-09-15",
      Count: "3",
    },
  ]);
  assert.equal(dataset.services.length, 1);
  assert.equal(dataset.services[0].Count, 3);
  assert.equal(dataset.services[0]["Project Start Date"], "2026-07-27");
  assert.equal(dataset.enrollments.length, 2);
  assert.equal(dataset.enrollments[0].service_count, 0);
  assert.equal(dataset.enrollments[0].last_service_date, undefined);
  assert.equal(dataset.enrollments[0]["Days Since Last Service"], null);
  assert.equal(dataset.enrollments[1].service_count, 1);
});

test("out-of-range reminders and attempts do not affect counts or contact dates", () => {
  const dataset = buildRows([
    { "Service Item Name": "Appointment Reminders", "Service Attendance Date": "2026-10-01" },
    { "Service Item Name": "Attempted Engagement", "Service Attendance Date": "2026-09-09" },
    { "Service Item Name": "Appointment Reminders", "Service Attendance Date": "2026-09-20" },
    { "Service Item Name": "Attempted Engagement", "Service Attendance Date": "2026-09-21" },
  ]);
  const enrollment = dataset.enrollments[0];
  assert.equal(dataset.services.length, 2);
  assert.equal(enrollment.service_count, 0);
  assert.equal(enrollment.appointment_reminder_count, 1);
  assert.equal(enrollment.attempted_engagement_count, 1);
  assert.equal(enrollment.last_service_date, "2026-09-20");
  assert.equal(enrollment.last_real_service_date, undefined);
});

test("blank legacy attendance is not replaced by a legacy summary or enrollment start date", () => {
  const dataset = buildRows([
    { "Last Start Date": "2026-09-10" },
    { "Service Item Name": "Appointment Reminders", "Last Start Date": "2026-09-10" },
    { "Service Item Name": "Attempted Engagement" },
    { "Service Item Name": "", "Service Attendance Date": "2026-09-15" },
  ]);
  const enrollment = dataset.enrollments[0];
  assert.equal(dataset.services.length, 0);
  assert.equal(enrollment.service_count, 0);
  assert.equal(enrollment.appointment_reminder_count, 0);
  assert.equal(enrollment.attempted_engagement_count, 1);
  assert.equal(enrollment.last_service_date, undefined);
});

for (const dateField of ["Start Start Date", "Start Date Date"]) {
  test(`attendance drives last service and client-list contact flags instead of ${dateField}`, (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-09T12:00:00") });
    const dataset = buildRows([
      {
        "Project Start Date": "2025-04-22",
        "Project Exit Date": "",
        "Active in Project": "Yes",
        [dateField]: "2025-12-09",
        "Service Attendance Date": "2026-11-05",
        "Last Attendance Date": "2026-09-09",
        "Last Start Date": "2026-10-30",
      },
    ]);
    assert.equal(dataset.services[0]["Service Attendance Date"], "2026-11-05");
    const enrollment = dataset.enrollments[0];
    assert.equal(enrollment.last_service_date, "2026-11-05");
    assert.equal(enrollment.last_real_service_date, "2026-11-05");
    assert.equal(enrollment["Days Since Last Service"], 4);
    assert.equal(enrollment.service_count, 1);
    const [client] = clientList(dataset, { active_only: true });
    assert.equal(client.days_since_service, 4);
    assert.equal(client.days_since_real_service, 4);
    assert.equal(client.flags.includes("No Recent Contact"), false);
    assert.equal(client.flags.includes("No Services"), false);
    assert.equal(clientList(dataset, { no_recent: true }).length, 0);
  });

  test(`${dateField} works without attendance columns and respects enrollment boundaries`, () => {
    const dataset = buildDatasetFromRawCsv(Papa.unparse(
      ["2026-09-09", "2026-09-10", "2026-09-30", "2026-10-01"].map((date) => ({
        "Unique Identifier": "test-client",
        Name: "Test Program",
        "Project Start Date": "2026-09-10",
        "Project Exit Date": "2026-09-30",
        "Service Item Name": "General Case Management",
        [dateField]: date,
      }))
    ));
    assert.deepEqual(dataset.services.map((service) => service["Service Attendance Date"]), [
      "2026-09-10", "2026-09-30",
    ]);
    assert.equal(dataset.enrollments[0].service_count, 2);
    assert.equal(dataset.enrollments[0].last_service_date, "2026-09-30");
  });

  test(`blank ${dateField} does not suppress attendance`, () => {
    const dataset = buildRows([{
      [dateField]: "",
      "Service Attendance Date": "2026-09-15",
      "Last Attendance Date": "2026-09-16",
      "Last Start Date": "2026-09-17",
    }]);
    assert.equal(dataset.services.length, 1);
    assert.equal(dataset.enrollments[0].service_count, 1);
    assert.equal(dataset.enrollments[0].last_service_date, "2026-09-15");
  });

  test(`invalid ${dateField} rejects ingestion`, () => {
    assert.throws(() => buildRows([{
      [dateField]: "not-a-date",
    }]), /Invalid CSV date/);
  });

  test(`${dateField} fills blank attendance only in the inclusive temporary window`, () => {
    const dataset = buildRows(
      ["2026-08-31", "2026-09-01", "2026-10-26", "2026-11-30", "2026-12-01"].map((date) => ({
        "Project Start Date": "2025-04-22",
        "Project Exit Date": "",
        [dateField]: date,
        "Last Start Date": "2026-10-30",
      }))
    );
    assert.deepEqual(dataset.services.map((service) => service["Service Attendance Date"]), [
      "2026-09-01", "2026-10-26", "2026-11-30",
    ]);
    assert.equal(dataset.enrollments[0].service_count, 3);
  });

  test(`${dateField} fallback restores recent contact without promoting attempted engagement`, (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-09T12:00:00") });
    const dataset = buildRows([
      {
        "Project Exit Date": "",
        [dateField]: "2026-10-26",
      },
      {
        "Project Exit Date": "",
        [dateField]: "2026-11-01",
        "Service Item Name": "Attempted Engagement",
      },
      {
        "Project Exit Date": "",
        [dateField]: "2026-10-28",
        "Service Item Name": "Appointment Reminders",
      },
    ]);
    const enrollment = dataset.enrollments[0];
    assert.equal(enrollment.service_count, 1);
    assert.equal(enrollment.attempted_engagement_count, 1);
    assert.equal(enrollment.appointment_reminder_count, 1);
    assert.equal(enrollment.last_real_service_date, "2026-10-26");
    assert.equal(enrollment.last_service_date, "2026-10-28");
    assert.equal(clientList(dataset, {})[0].days_since_real_service, 14);
    assert.equal(clientList(dataset, {})[0].flags.includes("No Recent Contact"), false);
  });

  test(`populated attendance is never replaced by a newer ${dateField}`, () => {
    const dataset = buildRows([{
      [dateField]: "2026-10-26",
      "Service Attendance Date": "2026-09-15",
    }]);
    assert.equal(dataset.enrollments[0].last_service_date, "2026-09-15");
  });

  test(`last attendance takes precedence over ${dateField} when primary attendance is blank`, () => {
    const dataset = buildRows([{
      [dateField]: "2026-09-20",
      "Last Attendance Date": "2026-09-15",
    }]);
    assert.equal(dataset.enrollments[0].last_service_date, "2026-09-15");
  });
}

test("supervisor last-real-service values keep exited and current enrollments separate", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-09T12:00:00") });
  const dataset = buildRows([
    {
      "Project Start Date": "2025-01-01",
      "Project Exit Date": "2026-03-17",
      "Service Attendance Date": "2026-03-16",
      "Start Date Date": "2025-01-01",
    },
    {
      "Project Start Date": "2025-01-01",
      "Project Exit Date": "2026-03-17",
      "Service Attendance Date": "2026-11-06",
      "Start Date Date": "2026-06-01",
    },
    {
      "Project Start Date": "2026-06-01",
      "Project Exit Date": "",
      "Active in Project": "Yes",
      "Service Attendance Date": "2026-11-06",
      "Start Date Date": "2026-06-01",
    },
  ]);
  const clients = clientList(dataset, {});
  const exited = clients.find((client) => client.exit_date === "2026-03-17");
  const active = clients.find((client) => client.exit_date === "");
  assert.ok(exited);
  assert.ok(active);
  assert.equal(exited.days_since_real_service, 238);
  assert.equal(exited.services_count, 1);
  assert.equal(active.days_since_real_service, 3);
  assert.equal(active.services_count, 1);
  assert.equal(clientList(dataset, { active_only: true }).length, 1);
});

test("legacy date fields still work when attendance columns are absent", () => {
  const dataset = buildDatasetFromRawCsv(Papa.unparse([{
    "Unique Identifier": "legacy-client",
    Name: "Test Program",
    "Project Start Date": "9/10/2026",
    "Project Exit Date": "9/30/2026",
    "Service Item Name": "General Case Management",
    "Last Start Date": "9/15/2026",
    Count: "1",
  }]));
  assert.equal(dataset.services.length, 1);
  assert.equal(dataset.services[0]["Service Attendance Date"], "2026-09-15");
  assert.equal(dataset.enrollments[0].service_count, 1);
});

test("staff names accept both CSV headers while preserving the existing header's precedence", () => {
  const dataset = buildRows([
    { "Assigned Staff": "", "Assigned Staff Name": "  Current Manager  " },
    { "Unique Identifier": "legacy-client", "Assigned Staff": "Legacy Manager", "Assigned Staff Name": "Other Manager" },
    { "Unique Identifier": "blank-client", "Assigned Staff": " ", "Assigned Staff Name": "" },
  ]);
  assert.equal(dataset.enrollments[0]["Assigned Staff"], "Current Manager");
  assert.equal(dataset.enrollments[1]["Assigned Staff"], "Legacy Manager");
  assert.equal(dataset.enrollments[2]["Assigned Staff"], undefined);
});

test("invalid nonblank date values reject ingestion instead of opening the enrollment range", () => {
  assert.throws(() => buildRows([{
    "Project Exit Date": "not-a-date",
    "Service Attendance Date": "2026-09-15",
  }]), /Invalid CSV date.*Project Exit Date/);
  assert.throws(() => buildRows([{
    "Service Attendance Date": "2026-02-30",
  }]), /Invalid CSV date.*Service Attendance Date/);
});
