import { EventEmitter } from "node:events";
import type {
	AgentProviderRegistry,
	AgentListMessagesOptions,
	AgentRuntime,
	AgentThreadHandle,
	AgentThreadListener,
	ThreadUsagePayload,
} from "@twodb/contracts";
import {
	newId,
	runAgentLoop,
	type AgentContentPart,
	type AgentLoopEvent,
	type AgentMessage,
	type AgentTool,
} from "@twodb/shared-backend";
import type { Kysely, Selectable } from "kysely";
import type { AgentDB } from "../db/schema";
import type { SecretBox } from "../lib/crypto";
import { jsonb, toThreadMessageDto } from "../lib/serialize";
import type { ThreadMessageDto } from "../../shared/types";
import { buildRuntimeProvider } from "./providers";

const DEFAULT_SYSTEM_PROMPT =
	"You are a helpful coding agent operating on a remote workspace through tools. " +
	"Read and modify files and run commands with the provided tools. Be concise.";

const MIN_MESSAGES_TO_COMPACT = 12;
const USAGE_EMIT_INTERVAL_MS = 250;
const CHARS_PER_TOKEN = 4;

const SUMMARY_SYSTEM_PROMPT =
	"You summarize coding-agent conversations. Produce a compact, factual " +
	"brief: the goal, decisions made, files read/modified, commands run and " +
	"their outcomes, and where the work stands now. Bullet points, under 400 " +
	"words. This summary replaces the conversation history, so keep everything " +
	"the agent needs to continue.";

const SUMMARY_MESSAGE_CAP = 2_000;
const SUMMARY_TOTAL_CAP = 120_000;

type ThreadRow = Selectable<AgentDB["agent_threads"]>;
type AgentRow = Selectable<AgentDB["agent_agents"]>;
type MessageRow = Selectable<AgentDB["agent_messages"]>;

export type RuntimeDeps = {
	db: Kysely<AgentDB>;
	secrets: SecretBox;
	registry: AgentProviderRegistry;
	/** backend bus emit (`io.twodb.agent.thread.*` facts) */
	emit: (event: string, payload: Record<string, unknown>) => void;
};

type RunUsage = {
	input: number;
	output: number;
	context: number;
	startedAt: number;
	deltaChars: number;
	lastEmitAt: number;
};

function messageText(message: AgentMessage): string {
	if (message.role === "tool_use") return JSON.stringify(message.input);
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return JSON.stringify(content);
	return content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function toContentParts(
	text: string,
	images?: unknown[],
): string | AgentContentPart[] {
	if (!images?.length) return text;
	const parts: AgentContentPart[] = [];
	if (text) parts.push({ type: "text", text });
	for (const image of images) {
		const img = image as {
			data?: string;
			mimeType?: string;
			mime_type?: string;
		};
		if (typeof img?.data !== "string") continue;
		parts.push({
			type: "image",
			data: img.data,
			mime_type: img.mimeType ?? img.mime_type ?? "image/png",
		});
	}
	return parts;
}

class ThreadHandleImpl implements AgentThreadHandle {
	readonly id: string;
	private readonly tools = new Map<string, AgentTool>();
	private readonly events = new EventEmitter();
	private current: AbortController | null = null;
	private usage: RunUsage | null = null;

	constructor(
		private readonly deps: RuntimeDeps,
		private row: ThreadRow,
	) {
		this.id = row.id;
		this.events.setMaxListeners(50);
	}

	registerTool(tool: unknown): void {
		const candidate = tool as AgentTool;
		if (
			!candidate ||
			typeof candidate.name !== "string" ||
			typeof candidate.run !== "function"
		) {
			throw new Error("tool must be an AgentTool with a name and run()");
		}
		this.tools.set(candidate.name, candidate);
	}

	registerTools(tools: unknown[]): void {
		for (const tool of tools) this.registerTool(tool);
	}

	removeTool(name: string): void {
		this.tools.delete(name);
	}

	stop(): boolean {
		if (!this.current) return false;
		this.current.abort();
		return true;
	}

	isRunning(): boolean {
		return this.current !== null;
	}

	on(event: string, listener: AgentThreadListener): () => void {
		this.events.on(event, listener);
		return () => this.events.off(event, listener);
	}

	async info(): Promise<Record<string, unknown>> {
		const row = await this.loadRow();
		const count = await this.deps.db
			.selectFrom("agent_messages")
			.select((eb) => eb.fn.countAll().as("count"))
			.where("thread_id", "=", this.id)
			.executeTakeFirst();
		return {
			id: row.id,
			workspace_id: row.workspace_id,
			agent_id: row.agent_id,
			thread_intent: row.thread_intent,
			is_archived: row.is_archived,
			running: this.current !== null,
			tools: [...this.tools.keys()],
			message_count: Number(count?.count ?? 0),
			created_at: row.created_at.toISOString(),
			updated_at: row.updated_at.toISOString(),
		};
	}

	private emitUsage(running: boolean, force = false): void {
		if (!this.usage) return;
		const now = Date.now();
		if (!force && now - this.usage.lastEmitAt < USAGE_EMIT_INTERVAL_MS) return;
		this.usage.lastEmitAt = now;
		const elapsedSec = Math.max((now - this.usage.startedAt) / 1000, 0.1);
		const estimated = this.usage.deltaChars / CHARS_PER_TOKEN;
		const payload: ThreadUsagePayload = {
			input_tokens: this.usage.input,
			output_tokens: this.usage.output,
			context_tokens: this.usage.context,
			tokens_per_second: running
				? Math.round((estimated / elapsedSec) * 10) / 10
				: null,
			running,
		};
		this.events.emit("usage", payload as unknown as Record<string, unknown>);
	}

	private async loadRunnableAgent() {
		const agentRow = await this.deps.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("id", "=", this.row.agent_id)
			.executeTakeFirst();
		if (!agentRow) throw new Error("agent was deleted");
		if (!agentRow.enabled) throw new Error("agent is disabled");
		if (!agentRow.model) throw new Error("agent has no model configured");
		const secret = agentRow.secret_encrypted
			? this.deps.secrets.decrypt(agentRow.secret_encrypted)
			: null;
		return {
			agentRow,
			...(await buildRuntimeProvider(
				this.deps.registry,
				{
					provider: agentRow.provider,
					model: agentRow.model,
					config: agentRow.config ?? {},
				},
				secret,
			)),
		};
	}

	private async loadMessages(): Promise<MessageRow[]> {
		return this.deps.db
			.selectFrom("agent_messages")
			.selectAll()
			.where("thread_id", "=", this.id)
			.orderBy("seq", "asc")
			.execute();
	}

	private async persistMessage(
		message: AgentMessage,
		seq: number,
	): Promise<ThreadMessageDto> {
		const id = newId("msg");
		await this.deps.db
			.insertInto("agent_messages")
			.values({
				id,
				thread_id: this.id,
				workspace_id: this.row.workspace_id,
				seq,
				role: message.role,
				message: jsonb(message as unknown as Record<string, unknown>),
			})
			.execute();
		const dto: ThreadMessageDto = {
			id,
			thread_id: this.id,
			seq,
			role: message.role,
			message: message as unknown as Record<string, unknown>,
			truncated: false,
			created_at: new Date().toISOString(),
		};
		this.events.emit("message", { message: dto });
		this.deps.emit("io.twodb.agent.thread.message-added", {
			workspace_id: this.row.workspace_id,
			thread_id: this.id,
			message: dto,
		});
		return dto;
	}

	private fanOut(event: AgentLoopEvent): void {
		if (event.type === "tool_execution_start") {
			this.events.emit("tool-start", {
				tool_call_id: event.tool_call_id,
				tool_name: event.tool_name,
				args: event.input,
			});
			return;
		}
		if (event.type === "tool_execution_update") {
			this.events.emit("tool-update", {
				tool_call_id: event.tool_call_id,
				tool_name: event.tool_name,
				partial_result: event.chunk,
			});
			return;
		}
		if (event.type === "tool_execution_end") {
			this.events.emit("tool-end", {
				tool_call_id: event.tool_call_id,
				tool_name: event.tool_name,
				is_error: event.is_error,
			});
			return;
		}

		const completion = event.event;
		if (completion.event === "start") {
			this.events.emit("message-start", { message: { role: "assistant" } });
			return;
		}
		if (completion.event === "tool_call_start") {
			// the chip appears while the model is still streaming the arguments
			this.events.emit("tool-start", {
				tool_call_id: completion.data.tool_call_id,
				tool_name: completion.data.tool_name,
				args: {},
			});
			return;
		}
		if (completion.event === "tool_call_end") {
			this.events.emit("tool-args", {
				tool_call_id: completion.data.tool_call_id,
				tool_name: completion.data.tool_name,
				args: completion.data.input,
			});
			return;
		}
		if (
			completion.event === "text" ||
			completion.event === "thinking" ||
			completion.event === "tool_call"
		) {
			if (this.usage) this.usage.deltaChars += completion.data.chunk.length;
			this.events.emit("message-update", {
				message: { role: "assistant" },
				delta: {
					type: completion.event,
					delta: completion.data.chunk,
					index: completion.data.index,
				},
			});
			this.emitUsage(true);
			return;
		}
		if (completion.event === "end" && this.usage) {
			this.usage.input += completion.data.usage.input_tokens;
			this.usage.output += completion.data.usage.output_tokens;
			this.usage.context =
				completion.data.usage.input_tokens +
				completion.data.usage.cache_read_input_tokens +
				completion.data.usage.output_tokens;
			this.emitUsage(true, true);
		}
	}

	async prompt(input: {
		text: string;
		images?: unknown[];
	}): Promise<ThreadMessageDto[]> {
		if (this.current) throw new Error("thread is already running");
		this.row = await this.loadRow();
		if (this.row.is_archived) throw new Error("thread is archived");
		const { agentRow, provider, model } = await this.loadRunnableAgent();
		console.log(
			`[agent] prompt thread=${this.id} provider=${agentRow.provider} model=${agentRow.model}`,
		);

		const existing = await this.loadMessages();
		let nextSeq =
			existing.length > 0 ? existing[existing.length - 1].seq + 1 : 0;

		const userMessage: AgentMessage = {
			id: newId("msg"),
			role: "user",
			content: toContentParts(input.text, input.images),
		};
		const added: ThreadMessageDto[] = [
			await this.persistMessage(userMessage, nextSeq++),
		];

		const history = existing.map(
			(row) => row.message as unknown as AgentMessage,
		);
		const systemMessage: AgentMessage = {
			id: newId("msg"),
			role: "system",
			content: buildSystemPrompt(agentRow, this.row),
		};

		this.usage = {
			input: 0,
			output: 0,
			context: 0,
			startedAt: Date.now(),
			deltaChars: 0,
			lastEmitAt: 0,
		};
		this.emitUsage(true, true);

		const controller = new AbortController();
		this.current = controller;

		try {
			const result = await runAgentLoop({
				provider,
				model,
				tools: [...this.tools.values()],
				messages: [systemMessage, ...history, userMessage],
				abort_signal: controller.signal,
				on_event: (event) => this.fanOut(event),
			});
			console.log(
				`[agent] loop done thread=${this.id} stop=${result.stop_reason} turns=${result.turns} messages=${result.messages.length}`,
			);

			for (const message of result.messages) {
				added.push(await this.persistMessage(message, nextSeq++));
				this.emitUsage(true, true);
			}

			this.emitUsage(false, true);
			this.events.emit("run-finished", { thread_id: this.id });
			this.deps.emit("io.twodb.agent.thread.run-finished", {
				workspace_id: this.row.workspace_id,
				thread_id: this.id,
			});
		} catch (error) {
			console.error(
				`[agent] loop failed thread=${this.id}:`,
				error instanceof Error ? error.message : error,
			);
			this.emitUsage(false, true);
			this.events.emit("run-failed", {
				thread_id: this.id,
				error: error instanceof Error ? error.message : String(error),
			});
			this.deps.emit("io.twodb.agent.thread.run-failed", {
				workspace_id: this.row.workspace_id,
				thread_id: this.id,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			this.current = null;
			this.usage = null;
			await this.deps.db
				.updateTable("agent_threads")
				.set({ updated_at: new Date() })
				.where("id", "=", this.id)
				.execute();
		}

		return added;
	}

	async compact(): Promise<{ removed: number }> {
		if (this.current) throw new Error("thread is already running");
		this.row = await this.loadRow();
		const { provider, model } = await this.loadRunnableAgent();

		const existing = await this.loadMessages();
		if (existing.length < MIN_MESSAGES_TO_COMPACT) {
			return { removed: 0 };
		}
		const conversation = serializeForSummary(
			existing.map((row) => row.message as Record<string, unknown>),
		);

		const result = await provider.api.completion(
			{
				tools: [],
				model,
				abort_signal: new AbortController().signal,
				messages: [
					{
						id: newId("msg"),
						role: "system",
						content: SUMMARY_SYSTEM_PROMPT,
					},
					{
						id: newId("msg"),
						role: "user",
						content: `Conversation so far:\n\n${conversation}\n\nWrite the summary now.`,
					},
				],
			},
			() => {},
		);
		const summary = result.messages
			.filter((message) => message.role === "assistant")
			.map(messageText)
			.join("\n")
			.trim();
		if (!summary) {
			throw new Error("compaction produced an empty summary");
		}

		await this.deps.db
			.deleteFrom("agent_messages")
			.where("thread_id", "=", this.id)
			.execute();
		const summaryMessage: AgentMessage = {
			id: newId("msg"),
			role: "user",
			content: `[Summary of the conversation so far]\n\n${summary}`,
		};
		await this.deps.db
			.insertInto("agent_messages")
			.values({
				id: summaryMessage.id,
				thread_id: this.id,
				workspace_id: this.row.workspace_id,
				seq: 0,
				role: "user",
				message: jsonb(summaryMessage as unknown as Record<string, unknown>),
			})
			.execute();

		this.events.emit("compacted", {
			thread_id: this.id,
			removed: existing.length,
		});
		this.deps.emit("io.twodb.agent.thread.compacted", {
			workspace_id: this.row.workspace_id,
			thread_id: this.id,
			removed: existing.length,
		});
		return { removed: existing.length };
	}

	async loadRow(): Promise<ThreadRow> {
		const row = await this.deps.db
			.selectFrom("agent_threads")
			.selectAll()
			.where("id", "=", this.id)
			.executeTakeFirst();
		if (!row) throw new Error("thread was deleted");
		this.row = row;
		return row;
	}
}

function serializeForSummary(messages: Record<string, unknown>[]): string {
	const lines = messages.map((message) => {
		const role = typeof message.role === "string" ? message.role : "unknown";
		if (role === "tool_result") {
			const toolName =
				typeof message.tool_name === "string" ? message.tool_name : "tool";
			return `[tool result: ${toolName}] ${extractText(message).slice(0, SUMMARY_MESSAGE_CAP)}`;
		}
		if (role === "tool_use") {
			const toolName =
				typeof message.tool_name === "string" ? message.tool_name : "tool";
			const result = message.result as { content?: unknown } | undefined;
			const resultText = result
				? extractText({ content: result.content }).slice(0, SUMMARY_MESSAGE_CAP)
				: "";
			return `assistant called ${toolName}: ${JSON.stringify(message.input ?? {}).slice(0, SUMMARY_MESSAGE_CAP)}${resultText ? `\n[result] ${resultText}` : ""}`;
		}
		return `${role}: ${extractText(message).slice(0, SUMMARY_MESSAGE_CAP)}`;
	});
	let out = lines.join("\n\n");
	if (out.length > SUMMARY_TOTAL_CAP) {
		const head = out.slice(0, 20_000);
		const tail = out.slice(-90_000);
		out = `${head}\n\n… [middle elided] …\n\n${tail}`;
	}
	return out;
}

function extractText(message: Record<string, unknown>): string {
	const content = message.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter(
				(block): block is { type: string; text: string } =>
					typeof block === "object" &&
					block !== null &&
					(block as { type?: unknown }).type === "text" &&
					typeof (block as { text?: unknown }).text === "string",
			)
			.map((block) => block.text)
			.join("\n");
	}
	if (content && typeof content === "object") return JSON.stringify(content);
	return "";
}

const clampInt = (value: number, min: number, max: number): number =>
	Math.min(Math.max(Math.floor(value), min), max);

export class AgentThreadRuntime implements AgentRuntime {
	private readonly handles = new Map<string, ThreadHandleImpl>();

	constructor(private readonly deps: RuntimeDeps) {}

	async createNewThread(input: {
		workspaceId: string;
		agentId: string;
		threadIntent?: string | null;
		tools?: unknown[];
		createdBy?: string;
	}): Promise<AgentThreadHandle> {
		const agent = await this.deps.db
			.selectFrom("agent_agents")
			.select("id")
			.where("id", "=", input.agentId)
			.where("workspace_id", "=", input.workspaceId)
			.executeTakeFirst();
		if (!agent) throw new Error("agent not found");

		const id = newId("thr");
		await this.deps.db
			.insertInto("agent_threads")
			.values({
				id,
				workspace_id: input.workspaceId,
				agent_id: input.agentId,
				thread_intent: input.threadIntent?.trim() || null,
				created_by: input.createdBy ?? "system",
			})
			.execute();

		const row = await this.deps.db
			.selectFrom("agent_threads")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		const handle = new ThreadHandleImpl(this.deps, row);
		handle.registerTools(input.tools ?? []);
		this.handles.set(id, handle);

		this.deps.emit("io.twodb.agent.thread.created", {
			workspace_id: input.workspaceId,
			thread_id: id,
		});
		return handle;
	}

	async getThread(threadId: string): Promise<AgentThreadHandle | undefined> {
		const cached = this.handles.get(threadId);
		if (cached) return cached;
		const row = await this.deps.db
			.selectFrom("agent_threads")
			.selectAll()
			.where("id", "=", threadId)
			.executeTakeFirst();
		if (!row) return undefined;
		const handle = new ThreadHandleImpl(this.deps, row);
		this.handles.set(threadId, handle);
		return handle;
	}

	async listMessages(
		threadId: string,
		options?: AgentListMessagesOptions,
	): Promise<ThreadMessageDto[]> {
		const limit = clampInt(options?.limit ?? 50, 1, 200);
		let query = this.deps.db
			.selectFrom("agent_messages")
			.selectAll()
			.where("thread_id", "=", threadId);
		if (options?.after !== undefined) {
			query = query.where("seq", ">", options.after);
		}
		let rows = await query.orderBy("seq", "desc").limit(limit).execute();
		rows = rows.reverse();
		return rows.map((row) => toThreadMessageDto(row));
	}

	async getMessage(messageId: string): Promise<ThreadMessageDto | undefined> {
		const row = await this.deps.db
			.selectFrom("agent_messages")
			.selectAll()
			.where("id", "=", messageId)
			.executeTakeFirst();
		return row ? toThreadMessageDto(row, { trim: false }) : undefined;
	}

	async compactThread(threadId: string): Promise<void> {
		const handle = await this.getThread(threadId);
		if (!handle) throw new Error("thread not found");
		await (handle as ThreadHandleImpl).compact();
	}

	async clearThread(threadId: string): Promise<void> {
		if (this.isRunning(threadId)) {
			throw new Error("thread is running");
		}
		await this.deps.db
			.deleteFrom("agent_messages")
			.where("thread_id", "=", threadId)
			.execute();
	}

	async setThreadAgent(threadId: string, agentId: string): Promise<void> {
		if (this.isRunning(threadId)) {
			throw new Error("thread is running");
		}
		await this.deps.db
			.updateTable("agent_threads")
			.set({ agent_id: agentId, updated_at: new Date() })
			.where("id", "=", threadId)
			.execute();
		const handle = this.handles.get(threadId);
		if (handle) await handle.loadRow();
	}

	isRunning(threadId: string): boolean {
		const handle = this.handles.get(threadId);
		return handle?.isRunning() ?? false;
	}

	stop(threadId: string): boolean {
		return this.handles.get(threadId)?.stop() ?? false;
	}
}

function buildSystemPrompt(agentRow: AgentRow, thread: ThreadRow): string {
	const base = agentRow.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
	if (!thread.thread_intent) return base;
	return `${base}\n\nThread intent: ${thread.thread_intent}`;
}
