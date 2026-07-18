import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Vendor {
  id: string;
  name: string;
  country: string;
  currency: "USD" | "EUR";
}

export interface Invoice {
  id: string;
  vendorId: string;
  amount: number;
  currency: "USD" | "EUR";
  issueDate: string;
  memo: string;
}

// Repo root: src/ and dist/ both sit three levels below it. Resolved via
// path (not new URL(rel, import.meta.url)) so bundlers don't treat fixture
// paths as static assets.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function loadJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(repoRoot, rel), "utf8")) as T;
}

export function loadVendors(): Promise<Vendor[]> {
  return loadJson<Vendor[]>(join("fixtures", "vendors.json"));
}

export function loadInvoices(): Promise<Invoice[]> {
  return loadJson<Invoice[]>(join("fixtures", "invoices.json"));
}
