import type { Selectable } from "kysely";
import type {
	AgentAgentsTable,
	AgentMessagesTable,
	AgentThreadsTable,
} from "../db/schema";
import type { AgentDto, ThreadDto, ThreadMessageDto } from "../../shared/types";
import type { SecretBox } from "./crypto";

/**
 * Write helper for jsonb columns: the pg driver serializes JS arrays as
 * Postgres array literals (`{...}`), not JSON — pre-stringify so jsonb
 * params parse correctly.
 */
export function jsonb<T>(value: T): T {
	return JSON.stringify(value) as unknown as T;
}

/**
 * Serializes a row for the api. Secret material is never exposed — only
 * which secret fields are set and whether an api key exists.
 */
export function toAgentDto(
	row: Selectable<AgentAgentsTable>,
	secrets: SecretBox,
): AgentDto {
	const payload = row.secret_encrypted
		? secrets.decrypt(row.secret_encrypted)
		: null;
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		name: row.name,
		description: row.description,
		provider: row.provider,
		auth_type: row.auth_type,
		config: row.config,
		secret_fields: Object.keys(payload?.fields ?? {}),
		has_api_key: typeof payload?.api_key === "string",
		model: row.model,
		system_prompt: row.system_prompt,
		options: row.options,
		enabled: row.enabled,
		last_verified_at: row.last_verified_at?.toISOString() ?? null,
		usage_last_fetched_at: row.usage_last_fetched_at?.toISOString() ?? null,
		usage_last_error: row.usage_last_error,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toThreadDto(row: Selectable<AgentThreadsTable>): ThreadDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		agent_id: row.agent_id,
		thread_intent: row.thread_intent,
		is_archived: row.is_archived,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

/** Cap for any single text block inside a message payload. */
export const MESSAGE_TEXT_LIMIT = 10_000;

/**
 * Returns a copy of the message with oversized text blocks (tool outputs,
 * long assistant text) cut to MESSAGE_TEXT_LIMIT, plus a flag so clients can
 * offer a "view full output" fetch.
 */
export function trimMessagePayload(message: Record<string, unknown>): {
	message: Record<string, unknown>;
	truncated: boolean;
} {
	const content = message.content;
	if (typeof content === "string") {
		if (content.length <= MESSAGE_TEXT_LIMIT) {
			return { message, truncated: false };
		}
		return {
			message: {
				...message,
				content: `${content.slice(0, MESSAGE_TEXT_LIMIT)}\n… [truncated]`,
			},
			truncated: true,
		};
	}
	if (!Array.isArray(content)) return { message, truncated: false };
	let truncated = false;
	const next = content.map((block) => {
		if (
			typeof block === "object" &&
			block !== null &&
			(block as { type?: unknown }).type === "text"
		) {
			const text = (block as { text?: unknown }).text;
			if (typeof text === "string" && text.length > MESSAGE_TEXT_LIMIT) {
				truncated = true;
				return {
					...(block as Record<string, unknown>),
					text: `${text.slice(0, MESSAGE_TEXT_LIMIT)}\n… [truncated]`,
				};
			}
		}
		return block;
	});
	if (!truncated) return { message, truncated: false };
	return { message: { ...message, content: next }, truncated: true };
}

export function toThreadMessageDto(
	row: Selectable<AgentMessagesTable>,
	options?: { trim?: boolean },
): ThreadMessageDto {
	const raw = row.message as Record<string, unknown>;
	const trimmed = options?.trim === false ? null : trimMessagePayload(raw);
	return {
		id: row.id,
		thread_id: row.thread_id,
		seq: row.seq,
		role: row.role,
		message: trimmed ? trimmed.message : raw,
		truncated: trimmed?.truncated ?? false,
		created_at: row.created_at.toISOString(),
	};
}
