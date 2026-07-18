import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical";
import type { Hash, Receipt } from "./types";

export function sha256Hex(input: string): Hash {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** sha256 over the canonical JSON of the receipt minus hash/signature. */
export function hashReceipt(r: Omit<Receipt, "hash" | "signature">): Hash {
  return sha256Hex(canonicalJson(r));
}
