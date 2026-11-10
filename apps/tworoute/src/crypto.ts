// AES-256-GCM encryption for provider API keys at rest — mirrors
// apps/twodb/src/db/provisioning.ts's encryptSecret/decryptSecret, keyed off
// TWODB_DATA_KEY (the stable per-app key TwoDB's orchestrator injects —
// never rotated, unlike the registration token). Swap both for a real
// secrets manager before any serious multi-tenant deployment.

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";

function key(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(encoded: string, secret: string): string {
  const buf = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
