export type AgentToolCallResult = {
	content: object;
	is_error: boolean;
	timestamp: number;
};

export type AgentToolCallMessage = {
	role: "tool_use";
	tool_name: string;
	tool_call_id: string;
	input: object;
	/** attached by the loop once the tool has run — one row per tool call */
	result?: AgentToolCallResult;
};

export type AgentToolResultMessage = {
	role: "tool_result";
	tool_name: string;
	tool_call_id: string;
	content: object;
	is_error: boolean;
	timestamp: number;
};

export type AgentToolSchema = {
	type: "object";
	properties?: Record<string, unknown>;
	required?: string[];
	additionalProperties?: boolean;
	[key: string]: unknown;
};

export type AgentToolInput = {
	input: object;
};

export type AgentToolStreamEvents = {
	output: { chunk: string };
};

export type AgentToolStreamEvent<
	T extends keyof AgentToolStreamEvents = keyof AgentToolStreamEvents,
> = T extends keyof AgentToolStreamEvents
	? {
			event: T;
			data: AgentToolStreamEvents[T];
		}
	: never;

export interface AgentToolRunContext {
	abort_signal?: AbortSignal;
	on_event?: (event: AgentToolStreamEvent) => void;
}

export type AgentToolResult = {
	content: object;
	is_error?: boolean;
};

export abstract class AgentTool {
	abstract readonly id: string;
	abstract readonly name: string;
	abstract readonly description: string;
	abstract readonly schema: AgentToolSchema;

	abstract run(
		input: AgentToolInput,
		context?: AgentToolRunContext,
	): Promise<AgentToolResult>;
}
