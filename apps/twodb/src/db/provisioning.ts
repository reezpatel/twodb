// TwoDB-only logic: creates a fresh Postgres role + schema for a newly
// registered app, scoped so that role can only touch its own schema. Core-
// data's `createPgDb()` is purely a runtime client elsewhere in the
// ecosystem — this file is the one place provisioning logic is allowed to
// live (per the architecture decision log).

import { Client } from "pg";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";

export interface ProvisionResult {
  schema: string;
  role: string;
  /** Plaintext — return this to the caller exactly once; only the encrypted form is persisted. */
  password: string;
  /** Connection string using the admin URL's own host (for TwoDB's own use / operator visibility). */
  connectionString: string;
  /** Connection string with the host rewritten to `containerDbHost` — this is what gets injected into the app's container, since "localhost" from the admin's perspective is not reachable from inside a Docker container. */
  containerConnectionString: string;
}

function identSafe(slug: string): string {
  const cleaned = slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  if (!cleaned) throw new Error("invalid app slug for provisioning");
  return cleaned;
}

export { identSafe };

export interface ProvisionOptions {
  /** Current password of the app's role (from the stored credentials). Kept as-is unless `rotate`. */
  existingPassword?: string;
  /** Force a new password even if the current one is known. */
  rotate?: boolean;
}

export async function provisionAppDatabase(
  adminConnectionString: string,
  slug: string,
  containerDbHost: string,
  opts: ProvisionOptions = {},
): Promise<ProvisionResult> {
  const name = identSafe(slug);
  const schema = name;
  const role = `app_${name}`;
  // Credentials are STABLE: when the caller knows the role's current password
  // it is kept and never touched. A new password is only set when the role is
  // created, when `rotate` is requested explicitly, or when the current one
  // is unrecoverable (heal).
  const keep = !opts.rotate && opts.existingPassword ? opts.existingPassword : null;
  const password = keep ?? randomBytes(24).toString("hex");

  const client = new Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    const exists = (await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).rowCount! > 0;
    const quotedPw = `'${password}'`; // hex only — safe to inline (DDL can't be parameterised)
    if (!exists) {
      await client.query(`CREATE ROLE ${client.escapeIdentifier(role)} WITH LOGIN PASSWORD ${quotedPw}`);
    } else if (!keep) {
      await client.query(`ALTER ROLE ${client.escapeIdentifier(role)} WITH PASSWORD ${quotedPw}`);
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${client.escapeIdentifier(schema)} AUTHORIZATION ${client.escapeIdentifier(role)}`);
    await client.query(`GRANT ALL ON SCHEMA ${client.escapeIdentifier(schema)} TO ${client.escapeIdentifier(role)}`);
    await client.query(`ALTER ROLE ${client.escapeIdentifier(role)} SET search_path = ${client.escapeIdentifier(schema)}`);
    // Default privileges so future tables the app creates stay owned/grantable the same way.
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${client.escapeIdentifier(schema)} GRANT ALL ON TABLES TO ${client.escapeIdentifier(role)}`,
    );
  } finally {
    await client.end();
  }

  const adminUrl = new URL(adminConnectionString);
  const connUrl = new URL(adminConnectionString);
  connUrl.username = role;
  connUrl.password = password;
  connUrl.pathname = adminUrl.pathname; // same database, different schema via role search_path

  const containerUrl = new URL(connUrl.toString());
  containerUrl.hostname = containerDbHost;

  return {
    schema,
    role,
    password,
    connectionString: connUrl.toString(),
    containerConnectionString: containerUrl.toString(),
  };
}

/** AES-256-GCM, keyed off TwoDB's own AUTH_SECRET. Good enough for self-hosted dev-grade storage; swap for a real secrets manager before any multi-tenant/prod deployment. */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(encoded: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
