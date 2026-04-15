import { get, put } from "@vercel/blob";
import type { Dataset } from "@/lib/dataset";

const CURRENT_PATHNAME = "fsc-dashboard/current.json";

function ensureBlobToken() {
  // The Vercel Blob SDK defaults to process.env.BLOB_READ_WRITE_TOKEN.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN env var (required to store uploaded CSV data in Vercel Blob)."
    );
  }
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readCurrentDataset(): Promise<Dataset | null> {
  ensureBlobToken();
  const res = await get(CURRENT_PATHNAME, { access: "private" });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await streamToText(res.stream);
  return JSON.parse(text) as Dataset;
}

export async function writeCurrentDataset(dataset: Dataset): Promise<void> {
  ensureBlobToken();
  await put(CURRENT_PATHNAME, JSON.stringify(dataset), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
