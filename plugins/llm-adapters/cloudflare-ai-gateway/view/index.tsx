import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { CloudflareAiGatewaySetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.cloudflare-ai-gateway", CloudflareAiGatewaySetup);

const CloudflareAiGatewayViewPlugin = {
  id: "io.twodb.llm.cloudflare-ai-gateway",
} satisfies ViewPlugin;

export default CloudflareAiGatewayViewPlugin;
