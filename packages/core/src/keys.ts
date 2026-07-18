import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import type { Hash } from "./types";

/**
 * ed25519 keypair, exported as base64 DER (spki for public, pkcs8 for private)
 * so keys survive JSON round-trips and can be reconstructed anywhere.
 */
export function generateRunKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

/** Sign the hash hex string (UTF-8 bytes) with the run's private key. Returns base64. */
export function signHash(hash: Hash, privateKeyB64: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyB64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  return sign(null, Buffer.from(hash, "utf8"), key).toString("base64");
}

/** Verify an ed25519 signature over the hash hex string. Never throws. */
export function verifyHashSignature(
  hash: Hash,
  signatureB64: string,
  publicKeyB64: string,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(hash, "utf8"),
      key,
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}
