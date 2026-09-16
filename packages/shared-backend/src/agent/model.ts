export enum AgentModelInput {
	TEXT = "text",
	IMAGE = "image",
}

export enum AgentThinkingLevel {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	NONE = "none",
}

export type AgentModel = {
	id: string;
	name: string;
	inputs: AgentModelInput[];
	thinking_levels: AgentThinkingLevel[];
	reasoning: boolean;
	context_window: number;
	max_tokens: number;

	cost?: {
		input: number;
		output: number;
		cache_read: number;
		cache_write: number;
	};
};
