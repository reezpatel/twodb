import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { CloudflareWorkersAiSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.cloudflare-workers-ai", CloudflareWorkersAiSetup);

const CloudflareWorkersAiViewPlugin = {
  id: "io.twodb.llm.cloudflare-workers-ai",
} satisfies ViewPlugin;

export default CloudflareWorkersAiViewPlugin;
