import "@twodb/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./index.css";
import { TwoDbPluginProvider } from "@twodb/shared-frontend";

// Plugins are bundled later (loaded via the admin plugin registry instead of
// statically mounted at boot). Until then, no plugin views run here.
// import IdentityPlugin from "@twodb/identity/view";
// import ContentPlugin from "@twodb/content/view";
// import CalendarPlugin from "@twodb/calendar/view";
// import NodePlugin from "@twodb/node/view";
// import CodePlugin from "@twodb/code/view";
// import AgentPlugin from "@twodb/agent/view";
// import KimiCodePlugin from "@twodb/agent-provider-kimi-code/view";
// import OpenaiPlugin from "@twodb/agent-provider-openai/view";
// import AnthropicPlugin from "@twodb/agent-provider-anthropic/view";
// import CodexPlugin from "@twodb/agent-provider-codex/view";
// import GooglePlugin from "@twodb/agent-provider-google/view";
// import OpenrouterPlugin from "@twodb/agent-provider-openrouter/view";
// import XaiPlugin from "@twodb/agent-provider-xai/view";
// import GroqPlugin from "@twodb/agent-provider-groq/view";
// import MistralPlugin from "@twodb/agent-provider-mistral/view";
// import DeepseekPlugin from "@twodb/agent-provider-deepseek/view";
// import TogetherPlugin from "@twodb/agent-provider-together/view";
// import FireworksPlugin from "@twodb/agent-provider-fireworks/view";
// import CerebrasPlugin from "@twodb/agent-provider-cerebras/view";
// import ZaiPlugin from "@twodb/agent-provider-zai/view";
// import MinimaxPlugin from "@twodb/agent-provider-minimax/view";
// import KilocodePlugin from "@twodb/agent-provider-kilocode/view";
// import ClinePlugin from "@twodb/agent-provider-cline/view";
// import OllamaCloudPlugin from "@twodb/agent-provider-ollama-cloud/view";
// import AzureOpenaiPlugin from "@twodb/agent-provider-azure-openai/view";
// import AmazonBedrockPlugin from "@twodb/agent-provider-amazon-bedrock/view";
// import GoogleVertexPlugin from "@twodb/agent-provider-google-vertex/view";
// import CloudflareAiGatewayPlugin from "@twodb/agent-provider-cloudflare-ai-gateway/view";
// import CloudflareWorkersAiPlugin from "@twodb/agent-provider-cloudflare-workers-ai/view";
// import CustomOpenaiPlugin from "@twodb/agent-provider-custom-openai/view";
// import ChatPlugin from "@twodb/chat/view";
// import MeetingsPlugin from "@twodb/meetings/view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const plugins: never[] = [
	// IdentityPlugin,
	// ContentPlugin,
	// CalendarPlugin,
	// NodePlugin,
	// CodePlugin,
	// AgentPlugin,
	// KimiCodePlugin,
	// OpenaiPlugin,
	// AnthropicPlugin,
	// CodexPlugin,
	// GooglePlugin,
	// OpenrouterPlugin,
	// XaiPlugin,
	// GroqPlugin,
	// MistralPlugin,
	// DeepseekPlugin,
	// TogetherPlugin,
	// FireworksPlugin,
	// CerebrasPlugin,
	// ZaiPlugin,
	// MinimaxPlugin,
	// KilocodePlugin,
	// ClinePlugin,
	// OllamaCloudPlugin,
	// AzureOpenaiPlugin,
	// AmazonBedrockPlugin,
	// GoogleVertexPlugin,
	// CloudflareAiGatewayPlugin,
	// CloudflareWorkersAiPlugin,
	// CustomOpenaiPlugin,
	// ChatPlugin,
	// MeetingsPlugin,
];

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TwoDbPluginProvider plugins={plugins}>
				<App />
			</TwoDbPluginProvider>
		</QueryClientProvider>
	</StrictMode>,
);
