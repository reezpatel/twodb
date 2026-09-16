import {
	AgentProvider,
	AgentThinkingLevel,
	newId,
	type AgentCompletionHandler,
	type AgentCompletionInput,
	type AgentCompletionResult,
	type AgentContentPart,
	type AgentMessage,
	type AgentModel,
	type AgentProviderQuota,
	type AgentQuotaWindow,
	type AgentStopReason,
	type AgentUsage,
	type Store,
} from "@twodb/shared-backend";
import {
	streamAnthropicMessages,
	type AnthropicContentBlock,
	type AnthropicMessage,
	type AnthropicThinkingConfig,
} from "./anthropic";
import { KIMI_CODE_MODELS } from "../shared/models";
import type { KimiCodeAuth } from "../shared/types";

export type KimiCodeCredentials = KimiCodeAuth;
export type KimiCodeData = Record<string, string>;

const MESSAGES_URL = "https://api.kimi.com/coding/v1/messages";
const USAGE_URL = "https://api.kimi.com/coding/v1/usages";
const REQUEST_TIMEOUT_MS = 10_000;

function textOf(content: string | AgentContentPart[]): string {
	if (typeof content === "string") return content;
	return content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

function toAnthropicMessages(messages: AgentMessage[]): {
	system: string | undefined;
	messages: AnthropicMessage[];
} {
	const systemParts: string[] = [];
	const out: AnthropicMessage[] = [];

	const pushBlock = (
		role: "user" | "assistant",
		block: AnthropicContentBlock,
	): void => {
		const last = out[out.length - 1];
		if (last && last.role === role) last.content.push(block);
		else out.push({ role, content: [block] });
	};

	for (const message of messages) {
		switch (message.role) {
			case "system":
				systemParts.push(textOf(message.content));
				break;
			case "user":
				if (typeof message.content === "string") {
					pushBlock("user", { type: "text", text: message.content });
				} else {
					for (const part of message.content) {
						pushBlock(
							"user",
							part.type === "image"
								? {
										type: "image",
										source: {
											type: "base64",
											media_type: part.mime_type,
											data: part.data,
										},
									}
								: { type: "text", text: part.text },
						);
					}
				}
				break;
			case "assistant":
				pushBlock("assistant", {
					type: "text",
					text: textOf(message.content),
				});
				break;
			case "tool_use":
				pushBlock("assistant", {
					type: "tool_use",
					id: message.tool_call_id,
					name: message.tool_name,
					input: message.input as Record<string, unknown>,
				});
				// Persisted rows carry the result inline; the wire needs it as a
				// separate user-side tool_result block right after the call.
				if (message.result) {
					pushBlock("user", {
						type: "tool_result",
						tool_use_id: message.tool_call_id,
						content: JSON.stringify(message.result.content),
						...(message.result.is_error ? { is_error: true } : {}),
					});
				}
				break;
			case "tool_result":
				pushBlock("user", {
					type: "tool_result",
					tool_use_id: message.tool_call_id,
					content: JSON.stringify(message.content),
					...(message.is_error ? { is_error: true } : {}),
				});
				break;
		}
	}

	return {
		system: systemParts.length ? systemParts.join("\n\n") : undefined,
		messages: out,
	};
}

function toStopReason(stopReason: string | null): AgentStopReason {
	switch (stopReason) {
		case "tool_use":
			return "tool_use";
		case "max_tokens":
			return "max_tokens";
		default:
			return "end_turn";
	}
}

function toThinkingConfig(
	level: AgentThinkingLevel | undefined,
	maxTokens: number,
): AnthropicThinkingConfig | undefined {
	if (!level || level === AgentThinkingLevel.NONE) return undefined;
	const fraction =
		level === AgentThinkingLevel.LOW
			? 0.25
			: level === AgentThinkingLevel.MEDIUM
				? 0.5
				: 0.75;
	return {
		type: "enabled",
		budget_tokens: Math.max(1024, Math.floor(maxTokens * fraction)),
	};
}

function usageNumber(usage: Record<string, unknown>, key: string): number {
	const value = usage[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

type StreamBlock = {
	type: string;
	id: string;
	name: string;
	text: string;
	json: string;
};

function parseToolInput(json: string): Record<string, unknown> {
	if (!json) return {};
	try {
		const parsed: unknown = JSON.parse(json);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function numberField(
	record: Record<string, unknown>,
	keys: string[],
): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return undefined;
}

function stringField(
	record: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function sanitizeError(text: string, maxLength = 120): string {
	const sanitized = text.replace(/\s+/g, " ").trim();
	return (sanitized || "unknown").slice(0, maxLength);
}

type KimiUsageWindow = {
	window: AgentQuotaWindow;
	used: number;
	limit: number;
	resetsAt?: number;
};

function windowType(label: string): AgentQuotaWindow {
	const normalized = label.toLowerCase();
	if (normalized.includes("5h") || normalized.includes("5 h")) return "5h";
	if (
		normalized.includes("weekly") ||
		normalized.includes("week") ||
		normalized.includes("7d")
	) {
		return "weekly";
	}
	if (
		normalized.includes("monthly") ||
		normalized.includes("month") ||
		normalized.includes("30d")
	) {
		return "monthly";
	}
	return "daily";
}

function parseResetMs(data: Record<string, unknown>): number | undefined {
	for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
		const value = data[key];
		if (typeof value === "string" && value.trim()) {
			const parsed = Date.parse(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	for (const key of ["reset_in", "resetIn", "ttl"]) {
		const seconds = numberField(data, [key]);
		if (seconds !== undefined && seconds > 0) {
			return Date.now() + Math.round(seconds * 1000);
		}
	}
	const window = asRecord(data["window"]);
	if (window) {
		const seconds = numberField(window, ["duration"]);
		if (seconds !== undefined && seconds > 0) {
			return Date.now() + Math.round(seconds * 1000);
		}
	}
	return undefined;
}

function limitLabel(
	item: Record<string, unknown>,
	detail: Record<string, unknown>,
	window: Record<string, unknown>,
	index: number,
): string {
	for (const key of ["name", "title", "scope"]) {
		const value = stringField(item, [key]) ?? stringField(detail, [key]);
		if (value) return value;
	}

	const duration =
		numberField(window, ["duration"]) ??
		numberField(item, ["duration"]) ??
		numberField(detail, ["duration"]);
	const timeUnit = String(
		window["timeUnit"] ?? item["timeUnit"] ?? detail["timeUnit"] ?? "",
	);

	if (duration !== undefined && duration > 0) {
		if (timeUnit.includes("MINUTE")) {
			if (duration >= 60 && duration % 60 === 0) {
				return `${duration / 60}h limit`;
			}
			return `${duration}m limit`;
		}
		if (timeUnit.includes("HOUR")) return `${duration}h limit`;
		if (timeUnit.includes("DAY")) return `${duration}d limit`;
		return `${duration}s limit`;
	}

	return `Limit #${index + 1}`;
}

function toWindow(
	data: Record<string, unknown>,
	defaultLabel: string,
): KimiUsageWindow | undefined {
	const limit = numberField(data, ["limit"]);
	let used = numberField(data, ["used"]);
	if (used === undefined) {
		const remaining = numberField(data, ["remaining"]);
		if (remaining !== undefined && limit !== undefined) {
			used = limit - remaining;
		}
	}
	if (used === undefined && limit === undefined) return undefined;

	const label = stringField(data, ["name", "title"]) ?? defaultLabel;
	const resetsAt = parseResetMs(data);
	return {
		window: windowType(label),
		used: used ?? 0,
		limit: limit ?? 0,
		...(resetsAt ? { resetsAt } : {}),
	};
}

function parseUsageWindows(
	payload: Record<string, unknown>,
): KimiUsageWindow[] {
	const data = asRecord(payload["data"]);
	const usage = data?.["usage"] ?? payload["usage"];
	const limits = data?.["limits"] ?? payload["limits"];
	const windows: KimiUsageWindow[] = [];

	const usageRecord = asRecord(usage);
	if (usageRecord) {
		const row = toWindow(usageRecord, "Weekly limit");
		if (row) windows.push(row);
	}

	if (Array.isArray(limits)) {
		for (let index = 0; index < limits.length; index++) {
			const item = asRecord(limits[index]);
			if (!item) continue;
			const detail = asRecord(item["detail"]) ?? item;
			const window = asRecord(item["window"]) ?? {};
			const row = toWindow(detail, limitLabel(item, detail, window, index));
			if (row) windows.push(row);
		}
	}

	return windows;
}

export class KimiCodeProvider extends AgentProvider<
	KimiCodeCredentials,
	KimiCodeData
> {
	readonly id = "kimi-code";
	readonly name = "Kimi For Coding";

	models: AgentModel[] = KIMI_CODE_MODELS;

	constructor(
		private readonly scope: string,
		credentialStore: Store<KimiCodeCredentials>,
		dataStore: Store<KimiCodeData>,
	) {
		super(credentialStore, dataStore);
	}

	async getUsage(): Promise<AgentProviderQuota> {
		const apiKey = await this.requireApiKey("Kimi For Coding usage");

		const response = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Kimi API error ${response.status}: ${sanitizeError(text)}`,
			);
		}

		let payload: Record<string, unknown>;
		try {
			payload = asRecord(JSON.parse(text)) ?? {};
		} catch {
			throw new Error("Kimi usage returned invalid JSON");
		}

		const windows = parseUsageWindows(payload).map((window) => ({
			window: window.window,
			used:
				window.limit > 0
					? Math.min(100, (window.used / window.limit) * 100)
					: window.used,
			limit: 100,
			...(window.resetsAt ? { resets_at: window.resetsAt } : {}),
		}));
		if (!windows.length) {
			throw new Error("Unexpected Kimi usage response structure");
		}

		return { subscription: { plan: "Kimi For Coding", windows } };
	}

	readonly api = {
		fetchModels: async (): Promise<AgentModel[]> => {
			this.models = KIMI_CODE_MODELS;
			return this.models;
		},

		testCredentials: async () => {
			const apiKey = await this.credentialStore.get(this.scope, "api_key");
			if (!apiKey) {
				return { success: false, message: "Missing Kimi API key" };
			}
			try {
				const response = await fetch(USAGE_URL, {
					headers: {
						Authorization: `Bearer ${apiKey}`,
						Accept: "application/json",
					},
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				if (response.ok) return { success: true };
				return {
					success: false,
					message: `Kimi API error ${response.status}: ${sanitizeError(await response.text())}`,
				};
			} catch (error) {
				return {
					success: false,
					message: error instanceof Error ? error.message : String(error),
				};
			}
		},

		completion: async (
			input: AgentCompletionInput,
			onEvent: AgentCompletionHandler,
		): Promise<AgentCompletionResult> => {
			const fail = (
				reason: string,
				type: "error" | "aborted" = "error",
			): never => {
				const error = new Error(reason);
				onEvent({ event: "error", data: { type, reason, errors: [error] } });
				throw error;
			};

			const apiKey = await this.credentialStore.get(this.scope, "api_key");
			if (!apiKey) {
				return fail("Kimi For Coding is not configured: missing api key");
			}

			const model = this.models.find((entry) => entry.id === input.model.id);
			if (!model) {
				return fail(`Unknown Kimi For Coding model: ${input.model.id}`);
			}

			const { system, messages } = toAnthropicMessages(input.messages);
			const thinking = toThinkingConfig(input.thinking_level, model.max_tokens);

			onEvent({ event: "start", data: undefined });

			try {
				const stream = streamAnthropicMessages(
					MESSAGES_URL,
					apiKey,
					{
						model: model.id,
						maxTokens: model.max_tokens,
						...(system ? { system } : {}),
						messages,
						tools: input.tools.map((tool) => ({
							name: tool.name,
							description: tool.description,
							input_schema: tool.schema,
						})),
						...(thinking ? { thinking } : {}),
					},
					input.abort_signal,
				);

				const blocks = new Map<number, StreamBlock>();
				let stopReason: string | null = null;
				let messageId: string | undefined;
				let inputUsage: Record<string, unknown> = {};
				let outputTokens = 0;

				for await (const event of stream) {
					switch (event.type) {
						case "message_start":
							inputUsage = event.message.usage ?? {};
							messageId = event.message.id;
							break;
						case "content_block_start": {
							const block: StreamBlock = {
								type: String(event.content_block["type"] ?? "text"),
								id: String(event.content_block["id"] ?? ""),
								name: String(event.content_block["name"] ?? ""),
								text: "",
								json: "",
							};
							blocks.set(event.index, block);
							if (block.type === "text") {
								onEvent({ event: "text_start", data: undefined });
							} else if (block.type === "thinking") {
								onEvent({ event: "thinking_start", data: undefined });
							} else if (block.type === "tool_use") {
								onEvent({
									event: "tool_call_start",
									data: {
										tool_call_id: block.id,
										tool_name: block.name,
									},
								});
							}
							break;
						}
						case "content_block_delta": {
							const block = blocks.get(event.index);
							const delta = event.delta;
							if (delta["type"] === "text_delta") {
								const chunk = String(delta["text"] ?? "");
								if (block) block.text += chunk;
								onEvent({
									event: "text",
									data: { chunk, index: event.index },
								});
							} else if (delta["type"] === "thinking_delta") {
								onEvent({
									event: "thinking",
									data: {
										chunk: String(delta["thinking"] ?? ""),
										index: event.index,
									},
								});
							} else if (delta["type"] === "input_json_delta") {
								const chunk = String(delta["partial_json"] ?? "");
								if (block) block.json += chunk;
								onEvent({
									event: "tool_call",
									data: {
										chunk,
										index: event.index,
										tool_call_id: block?.id ?? "",
									},
								});
							}
							break;
						}
						case "content_block_stop": {
							const block = blocks.get(event.index);
							if (!block) break;
							if (block.type === "text") {
								onEvent({ event: "text_end", data: undefined });
							} else if (block.type === "thinking") {
								onEvent({ event: "thinking_end", data: undefined });
							} else if (block.type === "tool_use") {
								onEvent({
									event: "tool_call_end",
									data: {
										tool_call_id: block.id,
										tool_name: block.name,
										input: parseToolInput(block.json),
									},
								});
							}
							break;
						}
						case "message_delta":
							stopReason = event.delta.stop_reason ?? null;
							outputTokens = event.usage?.output_tokens ?? outputTokens;
							break;
						case "message_stop": {
							const usage: AgentUsage = {
								input_tokens: usageNumber(inputUsage, "input_tokens"),
								output_tokens: outputTokens,
								thinking_tokens: 0,
								cache_read_input_tokens: usageNumber(
									inputUsage,
									"cache_read_input_tokens",
								),
							};

							const resultMessages: AgentMessage[] = [];
							const ordered = [...blocks.entries()].sort((a, b) => a[0] - b[0]);
							const resultId = messageId ?? newId("msg");
							for (const [, block] of ordered) {
								if (block.type === "text" && block.text) {
									resultMessages.push({
										id: resultId,
										role: "assistant",
										content: block.text,
										usage,
									});
								} else if (block.type === "tool_use") {
									resultMessages.push({
										id: newId("msg"),
										role: "tool_use",
										tool_name: block.name,
										tool_call_id: block.id,
										input: parseToolInput(block.json),
									});
								}
							}
							if (!resultMessages.length) {
								resultMessages.push({
									id: resultId,
									role: "assistant",
									content: "",
									usage,
								});
							}

							const result: AgentCompletionResult = {
								stop_reason: toStopReason(stopReason),
								messages: resultMessages,
								usage,
							};
							onEvent({ event: "end", data: result });
							return result;
						}
						case "error":
							throw new Error(event.error.message ?? "Kimi stream failed");
					}
				}

				throw new Error("Kimi stream ended without a message_stop event");
			} catch (error) {
				const aborted = input.abort_signal.aborted;
				const reason = error instanceof Error ? error.message : String(error);
				const err = error instanceof Error ? error : new Error(reason);
				onEvent({
					event: "error",
					data: {
						type: aborted ? "aborted" : "error",
						reason: aborted ? "aborted" : reason,
						errors: [err],
					},
				});
				throw err;
			}
		},
	};

	private async requireApiKey(label: string): Promise<string> {
		const apiKey = await this.credentialStore.get(this.scope, "api_key");
		if (!apiKey) throw new Error(`${label} requires an api key`);
		return apiKey;
	}
}
