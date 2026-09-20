import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { CodexSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.codex", CodexSetup);

const CodexViewPlugin = {
  id: "io.twodb.llm.codex",
} satisfies ViewPlugin;

export default CodexViewPlugin;
