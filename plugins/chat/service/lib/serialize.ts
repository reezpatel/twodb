import type {
	ChatConversationDto,
	ChatMemberDto,
	ChatMessageActionDto,
	ChatMessageDto,
} from "../../shared/types";
import type { Selectable } from "kysely";
import type {
	ChatConversationMembersTable,
	ChatConversationsTable,
	ChatMessageActionsTable,
	ChatMessagesTable,
} from "../db/schema";

export function jsonb<T>(value: T): T {
	return JSON.stringify(value) as unknown as T;
}

export function toConversationDto(
	row: Selectable<ChatConversationsTable>,
	memberCount: number,
	lastReadAt: Date | null,
): ChatConversationDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		kind: row.kind,
		title: row.title,
		slug: row.slug,
		parent_id: row.parent_id,
		is_archived: row.is_archived,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
		member_count: memberCount,
		last_read_at: lastReadAt?.toISOString() ?? null,
	};
}

export function toMemberDto(
	row: Selectable<ChatConversationMembersTable>,
): ChatMemberDto {
	return {
		conversation_id: row.conversation_id,
		user_id: row.user_id,
		role: row.role,
		last_read_message_id: row.last_read_message_id,
		last_read_at: row.last_read_at?.toISOString() ?? null,
		created_at: row.created_at.toISOString(),
	};
}

export function toMessageDto(
	row: Selectable<ChatMessagesTable>,
	reactions: ChatMessageDto["reactions"],
): ChatMessageDto {
	return {
		id: row.id,
		conversation_id: row.conversation_id,
		workspace_id: row.workspace_id,
		parent_message_id: row.parent_message_id,
		markdown: row.markdown,
		rich_blocks: row.rich_blocks,
		attachments: row.attachments,
		is_deleted: row.is_deleted,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
		reactions,
	};
}

export function toMessageActionDto(
	row: Selectable<ChatMessageActionsTable>,
): ChatMessageActionDto {
	return {
		id: row.id,
		message_id: row.message_id,
		user_id: row.user_id,
		action_id: row.action_id,
		value: row.value,
		created_at: row.created_at.toISOString(),
	};
}
