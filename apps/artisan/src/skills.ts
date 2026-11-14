import type { AgentRow, SessionRow, SkillRow } from "./db/schema.js";

/** How a skill is made available. One mode per skill:
 *  - global: every agent in every space
 *  - agents: all agents, or a list of agent ids
 *  - spaces: all spaces, or a list of space ids
 *  - types:  all agent types, or a list of types (sub_agent, persona, …, directory) */
export type SkillMode = "global" | "agents" | "spaces" | "types";
export const SKILL_MODES: SkillMode[] = ["global", "agents", "spaces", "types"];

export interface SkillScope {
  mode: SkillMode;
  /** true = no restriction on the chosen dimension (ids ignored). */
  all: boolean;
  ids: string[];
}

export function scopeOf(s: Pick<SkillRow, "scope_mode" | "scope_all" | "scope_ids_json">): SkillScope {
  const mode = (SKILL_MODES as string[]).includes(s.scope_mode) ? (s.scope_mode as SkillMode) : "global";
  let ids: string[] = [];
  try { ids = JSON.parse(s.scope_ids_json) as string[]; } catch { /* keep [] */ }
  return { mode, all: mode === "global" || Number(s.scope_all) === 1, ids };
}

/** Returns an error message when the scope is unusable, else null. */
export function validateScope(scope: SkillScope): string | null {
  if (!SKILL_MODES.includes(scope.mode)) return `unknown availability mode "${scope.mode}"`;
  if (scope.mode !== "global" && !scope.all && scope.ids.length === 0) return `pick at least one ${scope.mode === "types" ? "agent type" : scope.mode.slice(0, -1)} or choose "all"`;
  return null;
}

/** Is the skill available to this agent running in this session? */
export function skillApplies(skill: SkillRow, agent: AgentRow, session: Pick<SessionRow, "space_id">): boolean {
  const scope = scopeOf(skill);
  if (scope.all) return true;
  switch (scope.mode) {
    case "agents": return scope.ids.includes(agent.id);
    case "spaces": return scope.ids.includes(session.space_id);
    case "types": return scope.ids.includes(agent.type);
    default: return true;
  }
}
