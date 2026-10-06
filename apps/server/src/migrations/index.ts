import type { Migration } from "kysely/migration";
import { up as initial } from "./0001-initial";
import { up as llmTags } from "./0002-llm-tags";
import { up as codeSessionThinking } from "./0003-code-session-thinking";
import { up as codeCheckpoints } from "./0004-code-checkpoints";
import { up as assistantThinking } from "./0005-assistant-thread-thinking";
import { up as codeSessionTags } from "./0006-code-session-tags";
import { up as memoryScope } from "./0007-memory-scope";
import { up as assistantThreadAgent } from "./0008-assistant-thread-agent";
import { up as mergeAssistant } from "./0009-merge-assistant";
import { up as codeSessionPlan } from "./0010-code-session-plan";
import { up as mediaAsset } from "./0011-media-asset";
import { up as mcpServer } from "./0012-mcp-server";
import { up as codeSessionUnseen } from "./0013-code-session-unseen";
import { up as footerPreference } from "./0014-footer-preference";

// Keys sort lexicographically — prefix new migrations with the next number.
export const migrations: Record<string, Migration> = {
  "0001_initial": { up: initial },
  "0002_llm_tags": { up: llmTags },
  "0003_code_session_thinking": { up: codeSessionThinking },
  "0004_code_checkpoints": { up: codeCheckpoints },
  "0005_assistant_thread_thinking": { up: assistantThinking },
  "0006_code_session_tags": { up: codeSessionTags },
  "0007_memory_scope": { up: memoryScope },
  "0008_assistant_thread_agent": { up: assistantThreadAgent },
  "0009_merge_assistant": { up: mergeAssistant },
  "0010_code_session_plan": { up: codeSessionPlan },
  "0011_media_asset": { up: mediaAsset },
  "0012_mcp_server": { up: mcpServer },
  "0013_code_session_unseen": { up: codeSessionUnseen },
  "0014_footer_preference": { up: footerPreference },
};
