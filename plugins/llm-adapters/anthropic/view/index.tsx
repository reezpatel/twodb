import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { AnthropicSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.anthropic", AnthropicSetup);

const AnthropicViewPlugin = {
  id: "io.twodb.llm.anthropic",
} satisfies ViewPlugin;

export default AnthropicViewPlugin;
