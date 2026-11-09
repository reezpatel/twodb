import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Global agent-scoped background jobs: a persona / collaborator / sentinel
 * agent can register a background job under a stable identifier it chooses.
 * The job still belongs to the session that started it (completion message,
 * logs) — the identifier lets OTHER agents reach its lifecycle (status, logs,
 * kill) across sessions and runners. Global jobs are exempt from /new and
 * /compact retirement.
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session_job").addColumn("identifier", "text").execute();
  await db.schema.alterTable("code_session_job").addColumn("agentId", "text").execute();
  // Identifier lookups (and listing an agent's jobs) hit these; uniqueness is
  // enforced in app code among non-terminal jobs, not as a constraint —
  // identifiers may be reused once a job is done/failed/killed/lost.
  await db.schema.createIndex("code_session_job_identifier_idx").ifNotExists().on("code_session_job").column("identifier").execute();
  await db.schema.createIndex("code_session_job_agent_idx").ifNotExists().on("code_session_job").column("agentId").execute();
};
