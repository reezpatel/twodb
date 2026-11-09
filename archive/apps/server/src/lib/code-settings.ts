import { db } from "../auth";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt";
import type { RepoSkillSource } from "./skills";

export type TerminalScope = "runner" | "directory" | "session";

/** Which runner repo skill folders are read: `.agents/skills` (codex) on by default, `.claude/skills` (claude) off. */
export type SkillSources = Record<RepoSkillSource, boolean>;

export const DEFAULT_SKILL_SOURCES: SkillSources = { agents: true, claude: false };

export interface CodeSettings {
  terminalScope: TerminalScope;
  /** Effective system prompt body (override or default). */
  systemPrompt: string;
  /** True when no override is stored and the default is in effect. */
  systemPromptIsDefault: boolean;
  /** Repo skill folders read from the runner. */
  skillSources: SkillSources;
}

const DEFAULTS: CodeSettings = {
  terminalScope: "runner",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  systemPromptIsDefault: true,
  skillSources: DEFAULT_SKILL_SOURCES,
};

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseSkillSources(raw: unknown): SkillSources {
  if (!raw || typeof raw !== "object") return DEFAULT_SKILL_SOURCES;
  const record = raw as Record<string, unknown>;
  const agents = typeof record.agents === "boolean" ? record.agents : DEFAULT_SKILL_SOURCES.agents;
  const claude = typeof record.claude === "boolean" ? record.claude : DEFAULT_SKILL_SOURCES.claude;
  return { agents, claude };
}

export async function getCodeSettings(organizationId: string): Promise<CodeSettings> {
  const row = await db.selectFrom("organization").select("metadata").where("id", "=", organizationId).executeTakeFirst();
  const code = parseMeta(row?.metadata).code as Partial<CodeSettings> | undefined;
  const scope = code?.terminalScope;
  const override = typeof code?.systemPrompt === "string" ? code.systemPrompt : "";
  const systemPrompt = override.trim() ? override : DEFAULT_SYSTEM_PROMPT;
  return {
    terminalScope: scope === "directory" || scope === "session" ? scope : DEFAULTS.terminalScope,
    systemPrompt,
    systemPromptIsDefault: !override.trim(),
    skillSources: parseSkillSources(code?.skillSources),
  };
}

export interface CodeSettingsPatch {
  terminalScope?: TerminalScope;
  /** null (or empty) resets to the default prompt. */
  systemPrompt?: string | null;
  skillSources?: SkillSources;
}

export async function setCodeSettings(organizationId: string, patch: CodeSettingsPatch): Promise<CodeSettings> {
  const row = await db.selectFrom("organization").select("metadata").where("id", "=", organizationId).executeTakeFirst();
  const meta = parseMeta(row?.metadata);
  const current = (meta.code ?? {}) as Record<string, unknown>;
  // Persist only real fields — spreading the effective prompt in would freeze
  // the default as an override and break reset/default detection.
  const next = { ...current };
  if (patch.terminalScope !== undefined) next.terminalScope = patch.terminalScope;
  if (patch.systemPrompt !== undefined) next.systemPrompt = patch.systemPrompt;
  await db
    .updateTable("organization")
    .set({ metadata: JSON.stringify({ ...meta, code: next }) })
    .where("id", "=", organizationId)
    .execute();
  return getCodeSettings(organizationId);
}
