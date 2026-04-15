#!/usr/bin/env npx tsx
/**
 * Local CLI: ingest a CSV and push the processed dataset to Vercel Blob.
 *
 * Usage:
 *   npx tsx scripts/push-dataset.ts "../path/to/export.csv"
 *
 * Required env vars (set in .env.local or export them):
 *   BLOB_READ_WRITE_TOKEN   — from Vercel Storage → Blob
 *   INGEST_SALT             — same value as in Vercel env vars
 */

import fs from "node:fs";
import path from "node:path";

// Load .env.local (Next.js does this automatically, but tsx does not)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
import { put } from "@vercel/blob";
import { buildDatasetFromRawCsv } from "../src/lib/ingest";

const CURRENT_PATHNAME = "fsc-dashboard/current.json";

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/push-dataset.ts <path-to-csv>");
    process.exit(1);
  }

  if (!process.env.INGEST_SALT) {
    console.error("ERROR: INGEST_SALT env var is required.");
    process.exit(1);
  }

  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  console.log(`Reading CSV: ${resolved}`);
  const csvText = fs.readFileSync(resolved, "utf-8");
  const filename = path.basename(resolved);

  console.log("Building dataset (ingest + hash + dedup)...");
  const dataset = buildDatasetFromRawCsv(csvText, filename);

  console.log(
    `  → ${dataset.enrollments.length} enrollments, ${dataset.services.length} service events`
  );

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("\nERROR: BLOB_READ_WRITE_TOKEN env var is required to push.");
    console.error("Set it in dashboard/.env.local or export it.");
    console.error("Ingest succeeded — set the token and re-run to push.");
    process.exit(1);
  }

  console.log("Pushing to Vercel Blob...");
  const blob = await put(CURRENT_PATHNAME, JSON.stringify(dataset), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`Done! Blob URL: ${blob.url}`);
  console.log(`  uploaded at: ${dataset.meta.uploadedAt}`);
  console.log(`  source:      ${dataset.meta.sourceFilename}`);
  console.log(`  raw rows:    ${dataset.meta.rawRows}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
