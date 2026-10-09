import { createDb } from "../plugins/db";
import { env } from "../env";

// Own db instance: auth.ts imports this module for the sign-up hook, so a
// shared import would create a cycle. The pool is lazy and rarely used.

const db = createDb(env.databaseUrl);

export interface StorageDestination {
  backendId: string;
  /** Path prefix inside the backend (no leading/trailing slash; "" = root). */
  prefix: string;
}

export interface ServerSettings {
  signUpEnabled: boolean;
  storageDestinations: Record<string, StorageDestination>;
}

/** Known dedicated destinations — extensible; the id is the setting key. */
export const STORAGE_DESTINATIONS: { id: string; label: string; description: string }[] = [
  { id: "agent_assets", label: "Agents Assets", description: "where agents store their assets (files, uploads, generated artifacts)" },
  { id: "chat_assets", label: "Chat Assets", description: "where team-chat file attachments are stored" },
];

const DEFAULTS: ServerSettings = { signUpEnabled: true, storageDestinations: {} };

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

export async function getStorageDestinations(): Promise<Record<string, StorageDestination>> {
  return (await getServerSettings()).storageDestinations;
}

export async function setStorageDestination(id: string, destination: StorageDestination): Promise<Record<string, StorageDestination>> {
  const destinations = { ...(await getStorageDestinations()), [id]: destination };
  await setServerSetting("storageDestinations", destinations);
  return destinations;
}

export async function deleteStorageDestination(id: string): Promise<Record<string, StorageDestination>> {
  const current = { ...(await getStorageDestinations()) };
  delete current[id];
  await setServerSetting("storageDestinations", current);
  return current;
}

/** Normalizes a user-entered prefix: trims slashes, collapses empties, rejects traversal. */
export function normalizeStoragePrefix(raw: unknown): string | "invalid" {
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw !== "string") return "invalid";
  const segments = raw.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "." || s === "..")) return "invalid";
  const prefix = segments.join("/");
  return prefix.length > 200 ? "invalid" : prefix;
}
