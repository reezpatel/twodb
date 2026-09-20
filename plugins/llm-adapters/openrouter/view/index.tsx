import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { OpenRouterSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.openrouter", OpenRouterSetup);

const OpenRouterViewPlugin = {
  id: "io.twodb.llm.openrouter",
} satisfies ViewPlugin;

export default OpenRouterViewPlugin;
