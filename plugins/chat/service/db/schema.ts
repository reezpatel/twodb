import type { ChatAttachment, ChatRichBlock } from "../../shared/types";
import type { Generated } from "kysely";

export interface ChatConversationsTable {
	id: string;
	workspace_id: string;
	kind: "direct" | "group" | "channel";
	title: string | null;
	slug: string | null;
	parent_id: string | null;
	is_archived: Generated<boolean>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface ChatConversationMembersTable {
	conversation_id: string;
	workspace_id: string;
	user_id: string;
	role: "owner" | "admin" | "member";
	last_read_message_id: string | null;
	last_read_at: Date | null;
	created_at: Generated<Date>;
}

export interface ChatMessagesTable {
	id: string;
	conversation_id: string;
	workspace_id: string;
	parent_message_id: string | null;
	markdown: Generated<string>;
	rich_blocks: Generated<ChatRichBlock[]>;
	attachments: Generated<ChatAttachment[]>;
	is_deleted: Generated<boolean>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface ChatMessageReactionsTable {
	message_id: string;
	workspace_id: string;
	user_id: string;
	emoji: string;
	created_at: Generated<Date>;
}

export interface ChatMessageActionsTable {
	id: string;
	message_id: string;
	workspace_id: string;
	user_id: string;
	action_id: string;
	value: Generated<unknown>;
	created_at: Generated<Date>;
}

export interface ChatDB {
	chat_conversations: ChatConversationsTable;
	chat_conversation_members: ChatConversationMembersTable;
	chat_messages: ChatMessagesTable;
	chat_message_reactions: ChatMessageReactionsTable;
	chat_message_actions: ChatMessageActionsTable;
}
