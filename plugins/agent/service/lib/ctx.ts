import type { Kysely } from "kysely";
import type { AgentDB } from "../db/schema";
import type { SecretBox } from "./crypto";
import type { UsageCollector } from "../usage/collector";
import type { AgentThreadRuntime } from "../runner/agent-runtime";

export interface AgentCtx {
	db: Kysely<AgentDB>;
	secrets: SecretBox;
	collector: UsageCollector;
	runtime: AgentThreadRuntime;
}
