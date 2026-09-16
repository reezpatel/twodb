export type ChatConversationKind = "direct" | "group" | "channel";
export type ChatMemberRole = "owner" | "admin" | "member";
export type ChatAttachmentStatus = "pending" | "uploaded" | "failed";

export type ChatAttachment = {
	id: string;
	name: string;
	mime_type: string;
	size_bytes: number;
	storage_key?: string;
	url?: string;
	status: ChatAttachmentStatus;
};

export type ChatRichBlock =
	| {
			type: "button";
			id: string;
			label: string;
			value?: unknown;
			variant?: "primary" | "secondary" | "ghost";
	  }
	| {
			type: "input";
			id: string;
			label: string;
			placeholder?: string;
			input_type?: "text" | "number" | "date";
	  }
	| {
			type: "notice";
			id: string;
			body: string;
			tone?: "neutral" | "go" | "warning" | "danger";
	  };

export type ChatConversationDto = {
	id: string;
	workspace_id: string;
	kind: ChatConversationKind;
	title: string | null;
	slug: string | null;
	parent_id: string | null;
	is_archived: boolean;
	created_by: string;
	created_at: string;
	updated_at: string;
	member_count: number;
	last_read_at: string | null;
};

export type ChatMemberDto = {
	conversation_id: string;
	user_id: string;
	role: ChatMemberRole;
	last_read_message_id: string | null;
	last_read_at: string | null;
	created_at: string;
};

export type ChatMessageDto = {
	id: string;
	conversation_id: string;
	workspace_id: string;
	parent_message_id: string | null;
	markdown: string;
	rich_blocks: ChatRichBlock[];
	attachments: ChatAttachment[];
	is_deleted: boolean;
	created_by: string;
	created_at: string;
	updated_at: string;
	reactions: { emoji: string; count: number; reacted: boolean }[];
};

export type ChatMessageActionDto = {
	id: string;
	message_id: string;
	user_id: string;
	action_id: string;
	value: unknown;
	created_at: string;
};

export type ChatEventMap = {
	"io.twodb.chat.conversation.created": {
		workspace_id: string;
		conversation: ChatConversationDto;
	};
	"io.twodb.chat.conversation.updated": {
		workspace_id: string;
		conversation: ChatConversationDto;
	};
	"io.twodb.chat.message.sent": {
		workspace_id: string;
		message: ChatMessageDto;
	};
	"io.twodb.chat.message.updated": {
		workspace_id: string;
		message: ChatMessageDto;
	};
	"io.twodb.chat.message.reacted": {
		workspace_id: string;
		message_id: string;
		user_id: string;
		emoji: string;
	};
	"io.twodb.chat.conversation.read": {
		workspace_id: string;
		conversation_id: string;
		user_id: string;
		message_id: string | null;
	};
	"io.twodb.chat.message.actioned": {
		workspace_id: string;
		action: ChatMessageActionDto;
	};
};
