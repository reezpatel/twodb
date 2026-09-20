import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { OllamaSelfHostedSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.ollama-self-hosted", OllamaSelfHostedSetup);

const OllamaSelfHostedViewPlugin = {
  id: "io.twodb.llm.ollama-self-hosted",
} satisfies ViewPlugin;

export default OllamaSelfHostedViewPlugin;
