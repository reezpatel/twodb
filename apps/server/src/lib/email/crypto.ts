import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../../env";

// Connector secrets (passwords, OAuth refresh tokens) are sealed with
// AES-256-GCM. EMAIL_ENCRYPTION_KEY (32 bytes, base64 or hex) wins; otherwise
// a key is derived from the auth secret so dev setups work out of the box.

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("EMAIL_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
    cachedKey = buf;
  } else {
    cachedKey = Buffer.from(hkdfSync("sha256", env.auth.secret, "twodb-email", "email-credentials-v1", 32));
  }
  return cachedKey;
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function unseal<T>(sealed: string | null): T | null {
  if (!sealed) return null;
  const [version, iv, tag, body] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("invalid_sealed_value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}
