import {
	AgentModelInput,
	AgentThinkingLevel,
	type AgentModel,
} from "@twodb/shared-backend/agent/model";

const TEXT_IMAGE = [AgentModelInput.TEXT, AgentModelInput.IMAGE];
const THINKING_LEVELS = [
	AgentThinkingLevel.NONE,
	AgentThinkingLevel.LOW,
	AgentThinkingLevel.MEDIUM,
	AgentThinkingLevel.HIGH,
];
const K3_THINKING_LEVELS = [
	AgentThinkingLevel.NONE,
	AgentThinkingLevel.LOW,
	AgentThinkingLevel.HIGH,
];

export const KIMI_CODE_MODELS: AgentModel[] = [
	{
		id: "k3",
		name: "Kimi K3",
		inputs: TEXT_IMAGE,
		thinking_levels: K3_THINKING_LEVELS,
		reasoning: true,
		context_window: 1_048_576,
		max_tokens: 131_072,
		cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 0 },
	},
	{
		id: "k3-256k",
		name: "Kimi K3-256K",
		inputs: TEXT_IMAGE,
		thinking_levels: K3_THINKING_LEVELS,
		reasoning: true,
		context_window: 262_144,
		max_tokens: 131_072,
		cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
	},
	{
		id: "kimi-for-coding",
		name: "Kimi K2.7 Code",
		inputs: TEXT_IMAGE,
		thinking_levels: THINKING_LEVELS,
		reasoning: true,
		context_window: 262_144,
		max_tokens: 32_768,
		cost: { input: 0.95, output: 4, cache_read: 0.19, cache_write: 0 },
	},
	{
		id: "kimi-for-coding-highspeed",
		name: "Kimi For Coding HighSpeed",
		inputs: TEXT_IMAGE,
		thinking_levels: THINKING_LEVELS,
		reasoning: true,
		context_window: 262_144,
		max_tokens: 32_768,
		cost: { input: 1.9, output: 8, cache_read: 0.38, cache_write: 0 },
	},
];
