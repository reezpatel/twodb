import type { AgentModel, AgentThinkingLevel } from "./model";
import type { Store } from "./store";
import type {
	AgentTool,
	AgentToolCallMessage,
	AgentToolResultMessage,
} from "./tool";

export type AgentTextContent = { type: "text"; text: string };
export type AgentImageContent = {
	type: "image";
	data: string;
	mime_type: string;
};
export type AgentContentPart = AgentTextContent | AgentImageContent;

export type AgentGenericMessage = {
	role: "user" | "assistant" | "system";
	content: string | AgentContentPart[];
};

export type AgentUsage = {
	input_tokens: number;
	output_tokens: number;
	thinking_tokens: number;
	cache_read_input_tokens: number;
};

export type AgentMessage = {
	id: string;
	usage?: AgentUsage;
} & (AgentGenericMessage | AgentToolCallMessage | AgentToolResultMessage);

export type AgentStopReason =
	| "end_turn"
	| "tool_use"
	| "max_tokens"
	| "aborted";

export interface AgentCompletionInput {
	tools: AgentTool[];
	messages: AgentMessage[];
	model: AgentModel;
	thinking_level?: AgentThinkingLevel;
	abort_signal: AbortSignal;
}

export interface AgentCompletionResult {
	stop_reason: AgentStopReason;
	messages: AgentMessage[];
	usage: AgentUsage;
}

export type AgentCompletionEvents = {
	start: void;
	end: AgentCompletionResult;
	error: { type: "error" | "aborted"; reason: string; errors: Error[] };

	text_start: void;
	text_end: void;
	text: { chunk: string; index: number };

	thinking_start: void;
	thinking_end: void;
	thinking: { chunk: string; index: number };

	tool_call_start: { tool_call_id: string; tool_name: string };
	tool_call_end: { tool_call_id: string; tool_name: string; input: object };
	tool_call: { chunk: string; index: number; tool_call_id: string };
};

export type AgentCompletionEvent<
	T extends keyof AgentCompletionEvents = keyof AgentCompletionEvents,
> = T extends keyof AgentCompletionEvents
	? {
			event: T;
			data: AgentCompletionEvents[T];
		}
	: never;

export type AgentCompletionHandler = (event: AgentCompletionEvent) => void;

export type AgentQuotaWindow =
	| "5h"
	| "daily"
	| "weekly"
	| "monthly"
	| (string & {});

export type AgentProviderQuota = {
	credit?: {
		balance?: number;
		used?: number;
		limit?: number;
		currency?: string;
	};
	subscription?: {
		plan?: string;
		windows: {
			window: AgentQuotaWindow;
			used?: number;
			limit?: number;
			resets_at?: number;
		}[];
	};
};

export abstract class AgentProvider<T extends object, U extends object> {
	constructor(
		protected credentialStore: Store<T>,
		protected dataStore: Store<U>,
	) {}

	abstract readonly id: string;
	abstract readonly name: string;

	abstract models: AgentModel[];

	abstract getUsage(): Promise<AgentProviderQuota>;

	abstract api: {
		fetchModels: () => Promise<AgentModel[]>;
		testCredentials: () => Promise<{
			success: boolean;
			message?: string;
			errors?: string[];
		}>;
		completion: (
			input: AgentCompletionInput,
			on_event: AgentCompletionHandler,
		) => Promise<AgentCompletionResult>;
	};
}
