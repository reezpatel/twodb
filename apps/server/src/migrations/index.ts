import type { Migration } from "kysely/migration";
import { up as initial } from "./0001-initial";
import { up as llmTags } from "./0002-llm-tags";
import { up as codeSessionThinking } from "./0003-code-session-thinking";

// Keys sort lexicographically — prefix new migrations with the next number.
export const migrations: Record<string, Migration> = {
  "0001_initial": { up: initial },
  "0002_llm_tags": { up: llmTags },
  "0003_code_session_thinking": { up: codeSessionThinking },
};
