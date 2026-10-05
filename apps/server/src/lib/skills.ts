import { db } from "../auth";
import type { Selectable } from "kysely";
import type { SkillTable } from "../plugins/db";
import { runnerManager } from "./runner-manager";

// Skill resolution for code sessions. Two sources:
// - DB skills (Settings → LLM → Skills): org-wide or directory-scoped, selected
//   by tag — the "default" tag or any tag carried by the session.
// - Repo skills: read live from the runner's working directory, never stored —
//   `.agents/skills/<name>/SKILL.md` (codex) and `.claude/skills/<name>/SKILL.md`
//   (claude). Only their titles reach the system prompt; content is fetched on
//   demand (read_skill tool, slash expansion).

export const DEFAULT_SKILL_TAG = "default";

export type RepoSkillSource = "agents" | "claude";

export const SKILL_SOURCE_ROOTS: Record<RepoSkillSource, string> = {
  agents: ".agents/skills",
  claude: ".claude/skills",
};

export interface SessionSkill {
  name: string;
  description: string;
  /** "db" for stored skills, or the repo folder the skill was found in. */
  source: "db" | RepoSkillSource;
}

/** Skills whose tags include "default" or overlap the session's tags. */
export function dbSkillMatches(skill: Selectable<SkillTable>, sessionTags: string[]): boolean {
  if (skill.tags.includes(DEFAULT_SKILL_TAG)) return true;
  return skill.tags.some((t) => sessionTags.includes(t));
}

/** Scope- and tag-filtered DB skills for a session. */
export async function listSessionDbSkills(organizationId: string, codeDirectoryId: string | null, sessionTags: string[]): Promise<SessionSkill[]> {
  const rows = await db
    .selectFrom("skill")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where((eb) => eb.or([eb("codeDirectoryId", "is", null), ...(codeDirectoryId ? [eb("codeDirectoryId", "=", codeDirectoryId)] : [])]))
    .execute();
  return rows.filter((r) => dbSkillMatches(r, sessionTags)).map((r) => ({ name: r.name, description: r.description, source: "db" }));
}

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** One flat listing of enabled repo skill roots: `<source>\t<name>` lines. */
export function repoListScript(cwd: string, sources: RepoSkillSource[]): string {
  const blocks = sources.map((source) => {
    const root = SKILL_SOURCE_ROOTS[source];
    // \${...} keeps the shell parameter expansion out of the template literal.
    return `for d in ${shq(root)}/*/; do [ -f "$d/SKILL.md" ] && printf '${source}\\t%s\\n' "\${d#${root}/}"; done 2>/dev/null`;
  });
  return [`cd ${shq(cwd)} 2>/dev/null || exit 9`, ...blocks, "exit 0"].join("\n");
}

/** Repo skills from the runner — empty when offline or the directory is gone. */
export async function listRepoSkills(runnerId: string | null, cwd: string | null, sources: RepoSkillSource[]): Promise<SessionSkill[]> {
  if (!runnerId || !cwd || sources.length === 0) return [];
  try {
    const result = await runnerManager.execOnRunner(runnerId, repoListScript(cwd, sources), undefined, { waitMs: 10_000 });
    if (result.code !== 0) return [];
    const skills: SessionSkill[] = [];
    const seen = new Set<string>();
    for (const line of result.stdout.split("\n")) {
      const [source, name] = line.trim().split("\t");
      const clean = (name ?? "").replace(/\/+$/, "");
      if ((source === "agents" || source === "claude") && clean && !seen.has(clean)) {
        seen.add(clean);
        skills.push({ name: clean, description: `${SKILL_SOURCE_ROOTS[source]}/${clean}/SKILL.md`, source });
      }
    }
    return skills;
  } catch {
    return [];
  }
}

/** Enabled roots in listing order. */
export function enabledRepoSources(sources: Record<RepoSkillSource, boolean>): RepoSkillSource[] {
  return (["agents", "claude"] as RepoSkillSource[]).filter((s) => sources[s]);
}

const SKILL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Reads a repo skill's SKILL.md from the runner across the enabled roots. */
export async function readRepoSkill(runnerId: string | null, cwd: string | null, sources: RepoSkillSource[], name: string): Promise<string | null> {
  if (!runnerId || !cwd || !SKILL_NAME_RE.test(name)) return null;
  const roots = sources.map((s) => SKILL_SOURCE_ROOTS[s]);
  const candidates = roots.map((r) => `${r}/${name}/SKILL.md`);
  const script = [`cd ${shq(cwd)} 2>/dev/null || exit 9`, ...candidates.map((p) => `if [ -f ${shq(p)} ]; then cat ${shq(p)}; exit 0; fi`), "exit 1"].join("\n");
  try {
    const result = await runnerManager.execOnRunner(runnerId, script, undefined, { waitMs: 15_000 });
    return result.code === 0 && result.stdout.trim() ? result.stdout : null;
  } catch {
    return null;
  }
}

/**
 * The `[Skills]` block for the system prompt — titles only, exactly the names
 * the read_skill tool and slash expansion accept.
 */
export function formatSkillsForPrompt(skills: SessionSkill[]): string {
  if (skills.length === 0) return "";
  const names = skills.map((s) => s.name);
  const lines: string[] = [];
  let current = "";
  for (const name of names) {
    if (current && (current + ", " + name).length > 96) {
      lines.push(current);
      current = name;
    } else {
      current = current ? `${current}, ${name}` : name;
    }
  }
  if (current) lines.push(current);
  return [
    "The following skills provide specialized instructions for specific tasks.",
    "Load a skill's full content with the read_skill tool (by name, exactly as listed) before following it.",
    "",
    "[Skills]",
    ...lines.map((l) => `  ${l}`),
  ].join("\n");
}
