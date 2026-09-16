export type AgentAuthMethod = "api_key" | "ambient" | "oauth";

export type AgentProviderField = {
	key: string;
	label: string;
	required?: boolean;
	secret?: boolean;
	placeholder?: string;
};

export type AgentProviderUsage = {
	supported: boolean;
	/** fetch governance: minimum ms between usage collections for this provider */
	ttlMs: number;
};

export type AgentProviderType = {
	id: string;
	label: string;
	auth: AgentAuthMethod[];
	fields: AgentProviderField[];
	usage: AgentProviderUsage;
};

const USAGE_TTL_MS = 15 * 60 * 1000;
const noUsage: AgentProviderUsage = { supported: false, ttlMs: 0 };
const usage: AgentProviderUsage = { supported: true, ttlMs: USAGE_TTL_MS };

const keyOnly = (
	id: string,
	label: string,
	usageSupport: AgentProviderUsage = noUsage,
): AgentProviderType => ({
	id,
	label,
	auth: ["api_key"],
	fields: [],
	usage: usageSupport,
});

/**
 * Static catalog of provider templates. Drives the dynamic UI form (the
 * backend is the source of truth for the form schema) and server-side
 * validation: fields marked `secret` are stored inside the encrypted blob,
 * the rest land in the `config` jsonb column. Only templates listed here are
 * offered for configuration in the UI.
 */
export const AGENT_PROVIDER_TYPES: AgentProviderType[] = [
	{
		id: "openai",
		label: "OpenAI",
		auth: ["api_key"],
		fields: [
			{
				key: "access_token",
				label: "ChatGPT OAuth Access Token",
				secret: true,
				placeholder: "for usage monitoring (subscription quota)",
			},
			{
				key: "account_id",
				label: "ChatGPT Account ID",
				placeholder: "optional — parsed from the token if absent",
			},
		],
		usage,
	},
	{
		id: "anthropic",
		label: "Anthropic",
		auth: ["api_key", "oauth"],
		fields: [
			{
				key: "refresh_token",
				label: "Claude OAuth Refresh Token",
				secret: true,
				required: true,
				placeholder:
					"~/.claude/.credentials.json → refreshToken — access tokens are auto-refreshed",
			},
			{
				key: "access_token",
				label: "Claude OAuth Access Token",
				secret: true,
				placeholder: "optional — auto-refreshed from the refresh token",
			},
			{
				key: "expires_at",
				label: "Access Token Expiry (ms epoch)",
				secret: true,
				placeholder: "auto-maintained after the first refresh",
			},
		],
		usage,
	},
	{
		id: "codex",
		label: "OpenAI Codex",
		auth: ["oauth"],
		fields: [
			{
				key: "refresh_token",
				label: "Codex OAuth Refresh Token",
				secret: true,
				required: true,
				placeholder:
					"~/.codex/auth.json → tokens.refresh_token — access tokens are auto-refreshed",
			},
			{
				key: "access_token",
				label: "Codex OAuth Access Token",
				secret: true,
				placeholder: "optional — auto-refreshed from the refresh token",
			},
			{
				key: "account_id",
				label: "ChatGPT Account ID",
				placeholder: "optional — parsed from the token if absent",
			},
		],
		usage,
	},
	keyOnly("google", "Google Gemini"),
	keyOnly("openrouter", "OpenRouter"),
	keyOnly("xai", "xAI"),
	keyOnly("groq", "Groq"),
	keyOnly("mistral", "Mistral"),
	keyOnly("deepseek", "DeepSeek"),
	keyOnly("together", "Together AI"),
	keyOnly("fireworks", "Fireworks"),
	keyOnly("cerebras", "Cerebras"),
	keyOnly("zai", "Z.ai Coding Plan", usage),
	keyOnly("kimi", "Kimi For Coding", usage),
	keyOnly("minimax", "MiniMax Coding Plan", usage),
	{
		id: "kilocode",
		label: "Kilo Code",
		auth: ["api_key"],
		fields: [
			{
				key: "session_cookie",
				label: "Session Cookie",
				secret: true,
				placeholder:
					"__Secure-next-auth.session-token value — for balance monitoring",
			},
		],
		usage,
	},
	{
		id: "cline",
		label: "Cline",
		auth: ["api_key", "oauth"],
		fields: [
			{
				key: "refresh_token",
				label: "Session Refresh Token",
				secret: true,
				required: true,
				placeholder: "api.cline.bot session — access tokens are auto-refreshed",
			},
			{
				key: "access_token",
				label: "Session Access Token",
				secret: true,
				placeholder: "optional — auto-refreshed from the refresh token",
			},
			{
				key: "expires_at",
				label: "Access Token Expiry (ms epoch)",
				secret: true,
				placeholder: "auto-maintained after the first refresh",
			},
		],
		usage,
	},
	{
		id: "ollama-cloud",
		label: "Ollama Cloud",
		auth: ["api_key"],
		fields: [
			{
				key: "cookie",
				label: "Session Cookie",
				secret: true,
				required: true,
				placeholder: "__Secure-session value",
			},
		],
		usage,
	},
	{
		id: "azure-openai",
		label: "Azure OpenAI",
		auth: ["api_key"],
		fields: [
			{
				key: "base_url",
				label: "Base URL",
				required: true,
				placeholder: "https://<resource>.openai.azure.com",
			},
			{ key: "api_version", label: "API Version", placeholder: "v1" },
			{
				key: "deployment_name_map",
				label: "Deployment Name Map",
				placeholder: "gpt-4o-mini=my-deployment,gpt-4o=prod",
			},
		],
		usage: noUsage,
	},
	{
		id: "amazon-bedrock",
		label: "Amazon Bedrock",
		auth: ["ambient", "api_key"],
		fields: [
			{
				key: "region",
				label: "Region",
				required: true,
				placeholder: "us-east-1",
			},
			{ key: "profile", label: "AWS Profile" },
			{ key: "access_key_id", label: "Access Key ID", secret: true },
			{ key: "secret_access_key", label: "Secret Access Key", secret: true },
			{ key: "session_token", label: "Session Token", secret: true },
		],
		usage: noUsage,
	},
	{
		id: "google-vertex",
		label: "Vertex AI",
		auth: ["api_key", "ambient"],
		fields: [
			{ key: "project", label: "Project" },
			{ key: "location", label: "Location", placeholder: "us-central1" },
			{
				key: "service_account_json",
				label: "Service Account JSON",
				secret: true,
			},
		],
		usage: noUsage,
	},
	{
		id: "cloudflare-ai-gateway",
		label: "Cloudflare AI Gateway",
		auth: ["api_key"],
		fields: [
			{ key: "account_id", label: "Account ID", required: true },
			{ key: "gateway_id", label: "Gateway ID", required: true },
		],
		usage: noUsage,
	},
	{
		id: "cloudflare-workers-ai",
		label: "Cloudflare Workers AI",
		auth: ["api_key"],
		fields: [{ key: "account_id", label: "Account ID", required: true }],
		usage: noUsage,
	},
	{
		id: "custom-openai",
		label: "OpenAI-compatible",
		auth: ["api_key"],
		fields: [
			{
				key: "base_url",
				label: "Base URL",
				required: true,
				placeholder: "http://localhost:11434/v1",
			},
		],
		usage: noUsage,
	},
];

export const providerTypeById = (id: string): AgentProviderType | undefined =>
	AGENT_PROVIDER_TYPES.find((type) => type.id === id);
