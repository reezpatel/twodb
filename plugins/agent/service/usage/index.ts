import type { UsageCredentials, UsageProvider } from "./base";
import { AnthropicUsage } from "./anthropic";
import { ClineUsage } from "./cline";
import { CodexUsage } from "./codex";
import { KilocodeUsage } from "./kilocode";
import { KimiUsage } from "./kimi";
import { MiniMaxUsage } from "./minimax";
import { OllamaCloudUsage } from "./ollama-cloud";
import { OpenAIUsage } from "./openai";
import { ZaiUsage } from "./zai";

export type UsageProviderEntry = {
	/** fetch governance: minimum ms between collections for this provider */
	ttlMs: number;
	create: (creds: UsageCredentials) => UsageProvider;
};

const TTL_MS = 15 * 60 * 1000;

const entry = (
	create: (creds: UsageCredentials) => UsageProvider,
	ttlMs = TTL_MS,
): UsageProviderEntry => ({ ttlMs, create });

/**
 * Usage fetchers per provider template id. A template without an entry
 * here is never collected, regardless of the cron tick.
 */
export const USAGE_PROVIDERS: Record<string, UsageProviderEntry> = {
	anthropic: entry((creds) => new AnthropicUsage(creds)),
	openai: entry((creds) => new OpenAIUsage(creds)),
	codex: entry((creds) => new CodexUsage(creds)),
	zai: entry((creds) => new ZaiUsage(creds)),
	kimi: entry((creds) => new KimiUsage(creds)),
	"kimi-code": entry((creds) => new KimiUsage(creds)),
	minimax: entry((creds) => new MiniMaxUsage(creds)),
	kilocode: entry((creds) => new KilocodeUsage(creds)),
	cline: entry((creds) => new ClineUsage(creds)),
	"ollama-cloud": entry((creds) => new OllamaCloudUsage(creds)),
};
