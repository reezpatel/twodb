import { db } from "../auth";

export type TerminalScope = "runner" | "directory" | "session";

export interface CodeSettings {
  terminalScope: TerminalScope;
}

const DEFAULTS: CodeSettings = { terminalScope: "runner" };

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getCodeSettings(organizationId: string): Promise<CodeSettings> {
  const row = await db.selectFrom("organization").select("metadata").where("id", "=", organizationId).executeTakeFirst();
  const code = parseMeta(row?.metadata).code as Partial<CodeSettings> | undefined;
  const scope = code?.terminalScope;
  return { terminalScope: scope === "directory" || scope === "session" ? scope : DEFAULTS.terminalScope };
}

export async function setCodeSettings(organizationId: string, patch: Partial<CodeSettings>): Promise<CodeSettings> {
  const row = await db.selectFrom("organization").select("metadata").where("id", "=", organizationId).executeTakeFirst();
  const meta = parseMeta(row?.metadata);
  const current = (meta.code ?? {}) as Partial<CodeSettings>;
  const next: CodeSettings = { ...DEFAULTS, ...current, ...patch };
  await db
    .updateTable("organization")
    .set({ metadata: JSON.stringify({ ...meta, code: next }) })
    .where("id", "=", organizationId)
    .execute();
  return next;
}
