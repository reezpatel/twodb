import { createDb } from "../plugins/db";
import { env } from "../env";

// Own db instance: auth.ts imports this module for the sign-up hook, so a
// shared import would create a cycle. The pool is lazy and rarely used.

const db = createDb(env.databaseUrl);

export interface ServerSettings {
  signUpEnabled: boolean;
}

const DEFAULTS: ServerSettings = { signUpEnabled: true };

export async function getServerSettings(): Promise<ServerSettings> {
  try {
    const rows = await db.selectFrom("server_setting").selectAll().execute();
    const overrides = Object.fromEntries(rows.map((r) => [r.key, (r.value as { value: unknown }).value])) as Partial<ServerSettings>;
    return { ...DEFAULTS, ...overrides };
  } catch {
    // table missing / db unavailable — fall back to defaults rather than breaking auth
    return { ...DEFAULTS };
  }
}

export async function setServerSetting(key: keyof ServerSettings, value: ServerSettings[keyof ServerSettings]) {
  const now = new Date();
  await db
    .insertInto("server_setting")
    .values({ key, value: { value } as Record<string, unknown>, updatedAt: now })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value: { value } as Record<string, unknown>, updatedAt: now }))
    .execute();
}
