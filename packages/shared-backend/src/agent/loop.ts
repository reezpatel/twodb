import { newId } from "../ids";
import type { AgentModel, AgentThinkingLevel } from "./model";
import type {
	AgentCompletionEvent,
	AgentMessage,
	AgentProvider,
	AgentStopReason,
	AgentUsage,
} from "./provider";
import type { AgentTool } from "./tool";

const DEFAULT_MAX_TURNS = 25;

export type AgentLoopEvent =
	| { type: "completion"; event: AgentCompletionEvent }
	| {
			type: "tool_execution_update";
			tool_call_id: string;
			tool_name: string;
			chunk: string;
	  }
	| {
			type: "tool_execution_start";
			tool_call_id: string;
			tool_name: string;
			input: object;
	  }
	| {
			type: "tool_execution_end";
			tool_call_id: string;
			tool_name: string;
			is_error: boolean;
	  };

export type AgentLoopInput = {
	// biome-ignore lint: the registry stores providers of any credential shape
	provider: AgentProvider<any, any>;
	model: AgentModel;
	tools: AgentTool[];
	messages: AgentMessage[];
	abort_signal: AbortSignal;
	thinking_level?: AgentThinkingLevel;
	max_turns?: number;
	on_event: (event: AgentLoopEvent) => void;
};

export type AgentLoopResult = {
	stop_reason: AgentStopReason;
	/** messages produced during the run, in order (assistant, tool_use, tool_result) */
	messages: AgentMessage[];
	usage: AgentUsage;
	turns: number;
	/** true when max_turns cut the run short while the model still wanted tools */
	exhausted: boolean;
};

function emptyUsage(): AgentUsage {
	return {
		input_tokens: 0,
		output_tokens: 0,
		thinking_tokens: 0,
		cache_read_input_tokens: 0,
	};
}

function addUsage(total: AgentUsage, next: AgentUsage): void {
	total.input_tokens += next.input_tokens;
	total.output_tokens += next.output_tokens;
	total.thinking_tokens += next.thinking_tokens;
	total.cache_read_input_tokens += next.cache_read_input_tokens;
}

export async function runAgentLoop(
	input: AgentLoopInput,
): Promise<AgentLoopResult> {
	const maxTurns = input.max_turns ?? DEFAULT_MAX_TURNS;
	const toolsByName = new Map(input.tools.map((tool) => [tool.name, tool]));
	const working = [...input.messages];
	const produced: AgentMessage[] = [];
	const usage = emptyUsage();
	let turns = 0;

	while (turns < maxTurns) {
		if (input.abort_signal.aborted) {
			return {
				stop_reason: "aborted",
				messages: produced,
				usage,
				turns,
				exhausted: false,
			};
		}
		turns += 1;

		const result = await input.provider.api.completion(
			{
				tools: input.tools,
				messages: working,
				model: input.model,
				abort_signal: input.abort_signal,
				...(input.thinking_level
					? { thinking_level: input.thinking_level }
					: {}),
			},
			(event) => input.on_event({ type: "completion", event }),
		);

		produced.push(...result.messages);
		working.push(...result.messages);
		addUsage(usage, result.usage);

		if (result.stop_reason !== "tool_use") {
			return {
				stop_reason: result.stop_reason,
				messages: produced,
				usage,
				turns,
				exhausted: false,
			};
		}

		for (const message of result.messages) {
			if (message.role !== "tool_use") continue;

			input.on_event({
				type: "tool_execution_start",
				tool_call_id: message.tool_call_id,
				tool_name: message.tool_name,
				input: message.input,
			});

			const tool = toolsByName.get(message.tool_name);
			let content: object;
			let isError = false;
			if (!tool) {
				content = { error: `unknown tool "${message.tool_name}"` };
				isError = true;
			} else {
				try {
					const output = await tool.run(
						{ input: message.input },
						{
							abort_signal: input.abort_signal,
							on_event: (toolEvent) =>
								input.on_event({
									type: "tool_execution_update",
									tool_call_id: message.tool_call_id,
									tool_name: message.tool_name,
									chunk: toolEvent.data.chunk,
								}),
						},
					);
					content = output.content;
					isError = output.is_error ?? false;
				} catch (error) {
					content = {
						error: error instanceof Error ? error.message : String(error),
					};
					isError = true;
				}
			}

			// The wire needs tool_result as its own message; persistence merges it
			// into the tool_use row (copy — the shared reference stays wire-clean).
			const toolResult: AgentMessage = {
				id: newId("msg"),
				role: "tool_result",
				tool_name: message.tool_name,
				tool_call_id: message.tool_call_id,
				content,
				is_error: isError,
				timestamp: Date.now(),
			};
			working.push(toolResult);

			const producedIndex = produced.findIndex(
				(entry) =>
					entry.role === "tool_use" &&
					entry.tool_call_id === message.tool_call_id,
			);
			if (producedIndex !== -1) {
				produced[producedIndex] = {
					...message,
					result: { content, is_error: isError, timestamp: Date.now() },
				};
			}

			input.on_event({
				type: "tool_execution_end",
				tool_call_id: message.tool_call_id,
				tool_name: message.tool_name,
				is_error: isError,
			});
		}
	}

	return {
		stop_reason: "tool_use",
		messages: produced,
		usage,
		turns,
		exhausted: true,
	};
}
