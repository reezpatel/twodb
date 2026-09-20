import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { ClaudeCodeSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.claude-code", ClaudeCodeSetup);

const ClaudeCodeViewPlugin = {
  id: "io.twodb.llm.claude-code",
} satisfies ViewPlugin;

export default ClaudeCodeViewPlugin;
