import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { OllamaCloudSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.ollama-cloud", OllamaCloudSetup);

const OllamaCloudViewPlugin = {
  id: "io.twodb.llm.ollama-cloud",
} satisfies ViewPlugin;

export default OllamaCloudViewPlugin;
