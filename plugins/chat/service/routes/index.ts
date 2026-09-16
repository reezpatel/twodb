import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type {
	ChatAttachment,
	ChatConversationKind,
	ChatMemberRole,
	ChatRichBlock,
} from "../../shared/types";
import type { ChatCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { createAttachmentUpload } from "../lib/uploads";
import {
	jsonb,
	toConversationDto,
	toMemberDto,
	toMessageActionDto,
	toMessageDto,
} from "../lib/serialize";

const conversationKinds = new Set<ChatConversationKind>([
	"direct",
	"group",
	"channel",
]);
const memberRoles = new Set<ChatMemberRole>(["owner", "admin", "member"]);

const fail = (
	reply: { code: (status: number) => { send: (body: unknown) => unknown } },
	message: string,
) => reply.code(400).send({ error: message });

const text = (value: unknown, name: string, max = 10_000): string => {
	if (typeof value !== "string") throw new Error(`${name} must be a string`);
	const result = value.trim();
	if (!result) throw new Error(`${name} is required`);
	if (result.length > max)
		throw new Error(`${name} must be at most ${max} characters`);
	return result;
};

const optionalText = (
	value: unknown,
	name: string,
	max = 10_000,
): string | null => {
	if (value === undefined || value === null || value === "") return null;
	return text(value, name, max);
};

const record = (value: unknown, name: string): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${name} must be an object`);
	}
	return value as Record<string, unknown>;
};

function blocks(value: unknown): ChatRichBlock[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new Error("rich_blocks must be an array");
	if (value.length > 20)
		throw new Error("A message can contain at most 20 rich blocks");
	return value.map((raw) => {
		const block = record(raw, "rich block");
		const id = text(block.id, "rich block id", 100);
		switch (block.type) {
			case "button":
				return {
					type: "button",
					id,
					label: text(block.label, "button label", 200),
					value: block.value,
					variant: ["primary", "secondary", "ghost"].includes(
						String(block.variant),
					)
						? (block.variant as "primary" | "secondary" | "ghost")
						: undefined,
				};
			case "input":
				return {
					type: "input",
					id,
					label: text(block.label, "input label", 200),
					placeholder:
						optionalText(block.placeholder, "input placeholder", 500) ??
						undefined,
					input_type: ["text", "number", "date"].includes(
						String(block.input_type),
					)
						? (block.input_type as "text" | "number" | "date")
						: "text",
				};
			case "notice":
				return {
					type: "notice",
					id,
					body: text(block.body, "notice body", 5_000),
					tone: ["neutral", "go", "warning", "danger"].includes(
						String(block.tone),
					)
						? (block.tone as "neutral" | "go" | "warning" | "danger")
						: "neutral",
				};
			default:
				throw new Error("Unsupported rich block type");
		}
	});
}

function attachments(value: unknown): ChatAttachment[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new Error("attachments must be an array");
	if (value.length > 20)
		throw new Error("A message can contain at most 20 attachments");
	return value.map((raw) => {
		const attachment = record(raw, "attachment");
		const sizeBytes = attachment.size_bytes;
		if (
			typeof sizeBytes !== "number" ||
			!Number.isSafeInteger(sizeBytes) ||
			sizeBytes < 0 ||
			sizeBytes > 5_000_000_000
		) {
			throw new Error("attachment size_bytes must be a byte count up to 5 GB");
		}
		const status = attachment.status;
		if (status !== "pending" && status !== "uploaded" && status !== "failed") {
			throw new Error("attachment status must be pending, uploaded, or failed");
		}
		return {
			id:
				typeof attachment.id === "string" && attachment.id.trim()
					? text(attachment.id, "attachment id", 100)
					: newId("chat-att"),
			name: text(attachment.name, "attachment name", 500),
			mime_type: text(attachment.mime_type, "attachment mime_type", 200),
			size_bytes: sizeBytes,
			storage_key:
				optionalText(attachment.storage_key, "attachment storage_key", 1_000) ??
				undefined,
			url: optionalText(attachment.url, "attachment url", 2_000) ?? undefined,
			status,
		};
	});
}

async function memberFor(
	ctx: ChatCtx,
	conversationId: string,
	workspaceId: string,
	userId: string,
) {
	return ctx.db
		.selectFrom("chat_conversation_members")
		.selectAll()
		.where("conversation_id", "=", conversationId)
		.where("workspace_id", "=", workspaceId)
		.where("user_id", "=", userId)
		.executeTakeFirst();
}

async function conversationFor(ctx: ChatCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("chat_conversations")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function conversationDto(
	ctx: ChatCtx,
	conversationId: string,
	workspaceId: string,
	userId: string,
) {
	const conversation = await conversationFor(ctx, conversationId, workspaceId);
	if (!conversation) return null;
	const [memberCount, member] = await Promise.all([
		ctx.db
			.selectFrom("chat_conversation_members")
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.where("conversation_id", "=", conversationId)
			.executeTakeFirstOrThrow(),
		memberFor(ctx, conversationId, workspaceId, userId),
	]);
	return toConversationDto(
		conversation,
		Number(memberCount.count),
		member?.last_read_at ?? null,
	);
}

async function messageDto(
	ctx: ChatCtx,
	messageId: string,
	workspaceId: string,
	userId: string,
) {
	const message = await ctx.db
		.selectFrom("chat_messages")
		.selectAll()
		.where("id", "=", messageId)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
	if (!message) return null;
	const reactions = await ctx.db
		.selectFrom("chat_message_reactions")
		.selectAll()
		.where("message_id", "=", messageId)
		.execute();
	const grouped = new Map<string, { count: number; reacted: boolean }>();
	for (const reaction of reactions) {
		const current = grouped.get(reaction.emoji) ?? { count: 0, reacted: false };
		current.count += 1;
		current.reacted ||= reaction.user_id === userId;
		grouped.set(reaction.emoji, current);
	}
	return toMessageDto(
		message,
		[...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value })),
	);
}

async function requireMember(
	fastify: TwodbFastifyInstance,
	ctx: ChatCtx,
	conversationId: string,
	workspaceId: string,
	userId: string,
) {
	const [conversation, member] = await Promise.all([
		conversationFor(ctx, conversationId, workspaceId),
		memberFor(ctx, conversationId, workspaceId, userId),
	]);
	if (!conversation || !member) return null;
	return { conversation, member };
}

function canManage(role: ChatMemberRole) {
	return role === "owner" || role === "admin";
}

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: ChatCtx,
): void {
	fastify.post("/uploads", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const name = text(body.name, "name", 500);
			const mimeType = text(body.mime_type, "mime_type", 200);
			if (
				typeof body.size_bytes !== "number" ||
				!Number.isSafeInteger(body.size_bytes) ||
				body.size_bytes < 0 ||
				body.size_bytes > 5_000_000_000
			) {
				throw new Error("size_bytes must be a byte count up to 5 GB");
			}
			return reply.code(201).send(
				await createAttachmentUpload(fastify, workspaceId, {
					name,
					mime_type: mimeType,
					size_bytes: body.size_bytes,
				}),
			);
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.get("/conversations", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const userId = principalOf(request).userId;
		const query = request.query as { kind?: string; archived?: string };
		let memberships = ctx.db
			.selectFrom("chat_conversation_members")
			.innerJoin(
				"chat_conversations",
				"chat_conversations.id",
				"chat_conversation_members.conversation_id",
			)
			.selectAll("chat_conversations")
			.select([
				"chat_conversation_members.last_read_at as member_last_read_at",
				"chat_conversation_members.conversation_id as member_conversation_id",
			])
			.where("chat_conversation_members.workspace_id", "=", workspaceId)
			.where("chat_conversation_members.user_id", "=", userId)
			.orderBy("chat_conversations.updated_at", "desc");
		if (query.archived !== "true")
			memberships = memberships.where(
				"chat_conversations.is_archived",
				"=",
				false,
			);
		if (
			query.kind &&
			conversationKinds.has(query.kind as ChatConversationKind)
		) {
			memberships = memberships.where(
				"chat_conversations.kind",
				"=",
				query.kind as ChatConversationKind,
			);
		}
		const rows = await memberships.execute();
		const conversations = await Promise.all(
			rows.map(async (row) => {
				const count = await ctx.db
					.selectFrom("chat_conversation_members")
					.select((eb) => eb.fn.countAll<number>().as("count"))
					.where("conversation_id", "=", row.id)
					.executeTakeFirstOrThrow();
				return toConversationDto(
					row,
					Number(count.count),
					row.member_last_read_at,
				);
			}),
		);
		return { conversations };
	});

	fastify.post("/conversations", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const userId = principalOf(request).userId;
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const kind = body.kind as ChatConversationKind;
			if (!conversationKinds.has(kind))
				throw new Error("kind must be direct, group, or channel");
			const title = optionalText(body.title, "title", 300);
			if (kind !== "direct" && !title)
				throw new Error("title is required for groups and channels");
			const slug =
				optionalText(body.slug, "slug", 120)
					?.toLowerCase()
					.replace(/[^a-z0-9-]/g, "-") ?? null;
			if (kind === "channel" && !slug)
				throw new Error("slug is required for channels");
			const parentId = optionalText(body.parent_id, "parent_id", 100);
			if (parentId && !(await conversationFor(ctx, parentId, workspaceId))) {
				throw new Error(
					"parent_id must reference a conversation in this workspace",
				);
			}
			const suppliedMembers =
				body.member_ids === undefined ? [] : body.member_ids;
			if (
				!Array.isArray(suppliedMembers) ||
				suppliedMembers.some((id) => typeof id !== "string" || !id.trim())
			) {
				throw new Error("member_ids must be an array of user ids");
			}
			const memberIds = [
				...new Set([userId, ...suppliedMembers.map((id) => id.trim())]),
			];
			if (kind === "direct" && memberIds.length !== 2) {
				throw new Error(
					"A direct conversation requires exactly one other member",
				);
			}
			if (memberIds.length > 200)
				throw new Error("A conversation can have at most 200 members");
			const id = newId("chat-conv");
			await ctx.db.transaction().execute(async (trx) => {
				await trx
					.insertInto("chat_conversations")
					.values({
						id,
						workspace_id: workspaceId,
						kind,
						title,
						slug,
						parent_id: parentId,
						created_by: userId,
					})
					.execute();
				await trx
					.insertInto("chat_conversation_members")
					.values(
						memberIds.map((memberId) => ({
							conversation_id: id,
							workspace_id: workspaceId,
							user_id: memberId,
							role:
								memberId === userId ? ("owner" as const) : ("member" as const),
						})),
					)
					.execute();
			});
			const conversation = await conversationDto(ctx, id, workspaceId, userId);
			if (!conversation) throw new Error("Conversation could not be created");
			fastify.bus.emit("io.twodb.chat.conversation.created", {
				workspace_id: workspaceId,
				conversation,
			});
			return reply.code(201).send({ conversation });
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.get("/conversations/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const conversation = await conversationDto(
			ctx,
			id,
			workspaceId,
			principalOf(request).userId,
		);
		if (!conversation)
			return reply.code(404).send({ error: "Conversation not found" });
		const member = await memberFor(
			ctx,
			id,
			workspaceId,
			principalOf(request).userId,
		);
		if (!member)
			return reply
				.code(403)
				.send({ error: "You are not a member of this conversation" });
		return { conversation };
	});

	fastify.patch("/conversations/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const access = await requireMember(fastify, ctx, id, workspaceId, userId);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		if (!canManage(access.member.role))
			return reply
				.code(403)
				.send({ error: "Only conversation administrators can edit it" });
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const updates: {
				title?: string | null;
				is_archived?: boolean;
				updated_at: Date;
			} = { updated_at: new Date() };
			if (body.title !== undefined)
				updates.title = optionalText(body.title, "title", 300);
			if (body.is_archived !== undefined) {
				if (typeof body.is_archived !== "boolean")
					throw new Error("is_archived must be a boolean");
				updates.is_archived = body.is_archived;
			}
			await ctx.db
				.updateTable("chat_conversations")
				.set(updates)
				.where("id", "=", id)
				.execute();
			const conversation = await conversationDto(ctx, id, workspaceId, userId);
			if (!conversation) throw new Error("Conversation not found");
			fastify.bus.emit("io.twodb.chat.conversation.updated", {
				workspace_id: workspaceId,
				conversation,
			});
			return { conversation };
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.get("/conversations/:id/members", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const access = await requireMember(
			fastify,
			ctx,
			id,
			workspaceId,
			principalOf(request).userId,
		);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		const members = await ctx.db
			.selectFrom("chat_conversation_members")
			.selectAll()
			.where("conversation_id", "=", id)
			.execute();
		return { members: members.map(toMemberDto) };
	});

	fastify.post("/conversations/:id/members", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const access = await requireMember(fastify, ctx, id, workspaceId, userId);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		if (!canManage(access.member.role))
			return reply
				.code(403)
				.send({ error: "Only conversation administrators can add members" });
		try {
			if (access.conversation.kind === "direct")
				throw new Error("Direct conversation membership cannot change");
			const body = (request.body ?? {}) as Record<string, unknown>;
			const memberId = text(body.user_id, "user_id", 100);
			const role =
				body.role === undefined ? "member" : (body.role as ChatMemberRole);
			if (!memberRoles.has(role) || role === "owner")
				throw new Error("role must be admin or member");
			await ctx.db
				.insertInto("chat_conversation_members")
				.values({
					conversation_id: id,
					workspace_id: workspaceId,
					user_id: memberId,
					role,
				})
				.onConflict((oc) =>
					oc.columns(["conversation_id", "user_id"]).doNothing(),
				)
				.execute();
			return reply
				.code(201)
				.send({
					member: toMemberDto(
						(await memberFor(ctx, id, workspaceId, memberId))!,
					),
				});
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.delete(
		"/conversations/:id/members/:userId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const { id, userId: memberId } = request.params as {
				id: string;
				userId: string;
			};
			const userId = principalOf(request).userId;
			const access = await requireMember(fastify, ctx, id, workspaceId, userId);
			if (!access)
				return reply.code(404).send({ error: "Conversation not found" });
			if (memberId !== userId && !canManage(access.member.role))
				return reply
					.code(403)
					.send({ error: "Only administrators can remove other members" });
			if (access.conversation.kind === "direct")
				return fail(reply, "Direct conversation membership cannot change");
			if (memberId === access.conversation.created_by)
				return fail(reply, "The conversation owner cannot be removed");
			await ctx.db
				.deleteFrom("chat_conversation_members")
				.where("conversation_id", "=", id)
				.where("user_id", "=", memberId)
				.execute();
			return { deleted: true };
		},
	);

	fastify.get("/conversations/:id/messages", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const access = await requireMember(fastify, ctx, id, workspaceId, userId);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		const query = request.query as { limit?: string };
		const limit = Math.min(
			Math.max(Number.parseInt(query.limit ?? "50", 10) || 50, 1),
			100,
		);
		const messages = await ctx.db
			.selectFrom("chat_messages")
			.selectAll()
			.where("conversation_id", "=", id)
			.orderBy("created_at", "desc")
			.limit(limit)
			.execute();
		const hydrated = await Promise.all(
			messages
				.reverse()
				.map((message) => messageDto(ctx, message.id, workspaceId, userId)),
		);
		return {
			messages: hydrated.filter(
				(message): message is NonNullable<typeof message> => message !== null,
			),
		};
	});

	fastify.post("/conversations/:id/messages", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const access = await requireMember(fastify, ctx, id, workspaceId, userId);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const markdown = optionalText(body.markdown, "markdown", 50_000) ?? "";
			const richBlocks = blocks(body.rich_blocks);
			const messageAttachments = attachments(body.attachments);
			if (!markdown && !richBlocks.length && !messageAttachments.length)
				throw new Error(
					"A message needs Markdown, a rich block, or an attachment",
				);
			const parentId = optionalText(
				body.parent_message_id,
				"parent_message_id",
				100,
			);
			if (parentId) {
				const parent = await ctx.db
					.selectFrom("chat_messages")
					.select(["conversation_id"])
					.where("id", "=", parentId)
					.where("workspace_id", "=", workspaceId)
					.executeTakeFirst();
				if (!parent || parent.conversation_id !== id)
					throw new Error("parent_message_id must belong to this conversation");
			}
			const messageId = newId("chat-msg");
			await ctx.db.transaction().execute(async (trx) => {
				await trx
					.insertInto("chat_messages")
					.values({
						id: messageId,
						conversation_id: id,
						workspace_id: workspaceId,
						parent_message_id: parentId,
						markdown,
						rich_blocks: jsonb(richBlocks),
						attachments: jsonb(messageAttachments),
						created_by: userId,
					})
					.execute();
				await trx
					.updateTable("chat_conversations")
					.set({ updated_at: new Date() })
					.where("id", "=", id)
					.execute();
			});
			const message = await messageDto(ctx, messageId, workspaceId, userId);
			if (!message) throw new Error("Message could not be created");
			fastify.bus.emit("io.twodb.chat.message.sent", {
				workspace_id: workspaceId,
				message,
			});
			return reply.code(201).send({ message });
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.patch("/messages/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const message = await ctx.db
			.selectFrom("chat_messages")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!message) return reply.code(404).send({ error: "Message not found" });
		const access = await requireMember(
			fastify,
			ctx,
			message.conversation_id,
			workspaceId,
			userId,
		);
		if (!access)
			return reply
				.code(403)
				.send({ error: "You are not a member of this conversation" });
		if (message.created_by !== userId || message.is_deleted)
			return reply
				.code(403)
				.send({ error: "Only the author can edit an active message" });
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const markdown =
				body.markdown === undefined
					? message.markdown
					: (optionalText(body.markdown, "markdown", 50_000) ?? "");
			const richBlocks =
				body.rich_blocks === undefined
					? message.rich_blocks
					: blocks(body.rich_blocks);
			const messageAttachments =
				body.attachments === undefined
					? message.attachments
					: attachments(body.attachments);
			if (!markdown && !richBlocks.length && !messageAttachments.length)
				throw new Error(
					"A message needs Markdown, a rich block, or an attachment",
				);
			await ctx.db
				.updateTable("chat_messages")
				.set({
					markdown,
					rich_blocks: jsonb(richBlocks),
					attachments: jsonb(messageAttachments),
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
			const updated = await messageDto(ctx, id, workspaceId, userId);
			if (!updated) throw new Error("Message not found");
			fastify.bus.emit("io.twodb.chat.message.updated", {
				workspace_id: workspaceId,
				message: updated,
			});
			return { message: updated };
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.delete("/messages/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const message = await ctx.db
			.selectFrom("chat_messages")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!message) return reply.code(404).send({ error: "Message not found" });
		const access = await requireMember(
			fastify,
			ctx,
			message.conversation_id,
			workspaceId,
			userId,
		);
		if (
			!access ||
			(message.created_by !== userId && !canManage(access.member.role))
		)
			return reply
				.code(403)
				.send({
					error: "Only the author or an administrator can delete this message",
				});
		await ctx.db
			.updateTable("chat_messages")
			.set({
				markdown: "",
				rich_blocks: jsonb([]),
				attachments: jsonb([]),
				is_deleted: true,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
		const updated = await messageDto(ctx, id, workspaceId, userId);
		if (updated)
			fastify.bus.emit("io.twodb.chat.message.updated", {
				workspace_id: workspaceId,
				message: updated,
			});
		return { deleted: true };
	});

	fastify.put("/messages/:id/reactions/:emoji", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id, emoji } = request.params as { id: string; emoji: string };
		const userId = principalOf(request).userId;
		if (!emoji || emoji.length > 32)
			return fail(reply, "emoji must be between 1 and 32 characters");
		const message = await ctx.db
			.selectFrom("chat_messages")
			.select(["conversation_id"])
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (
			!message ||
			!(await requireMember(
				fastify,
				ctx,
				message.conversation_id,
				workspaceId,
				userId,
			))
		)
			return reply.code(404).send({ error: "Message not found" });
		await ctx.db
			.insertInto("chat_message_reactions")
			.values({
				message_id: id,
				workspace_id: workspaceId,
				user_id: userId,
				emoji,
			})
			.onConflict((oc) =>
				oc.columns(["message_id", "user_id", "emoji"]).doNothing(),
			)
			.execute();
		fastify.bus.emit("io.twodb.chat.message.reacted", {
			workspace_id: workspaceId,
			message_id: id,
			user_id: userId,
			emoji,
		});
		return { reacted: true };
	});

	fastify.delete("/messages/:id/reactions/:emoji", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id, emoji } = request.params as { id: string; emoji: string };
		const userId = principalOf(request).userId;
		const message = await ctx.db
			.selectFrom("chat_messages")
			.select(["conversation_id"])
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (
			!message ||
			!(await requireMember(
				fastify,
				ctx,
				message.conversation_id,
				workspaceId,
				userId,
			))
		)
			return reply.code(404).send({ error: "Message not found" });
		await ctx.db
			.deleteFrom("chat_message_reactions")
			.where("message_id", "=", id)
			.where("user_id", "=", userId)
			.where("emoji", "=", emoji)
			.execute();
		fastify.bus.emit("io.twodb.chat.message.reacted", {
			workspace_id: workspaceId,
			message_id: id,
			user_id: userId,
			emoji,
		});
		return { reacted: false };
	});

	fastify.put("/conversations/:id/read", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const access = await requireMember(fastify, ctx, id, workspaceId, userId);
		if (!access)
			return reply.code(404).send({ error: "Conversation not found" });
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const messageId = optionalText(body.message_id, "message_id", 100);
			if (messageId) {
				const message = await ctx.db
					.selectFrom("chat_messages")
					.select(["conversation_id"])
					.where("id", "=", messageId)
					.where("workspace_id", "=", workspaceId)
					.executeTakeFirst();
				if (!message || message.conversation_id !== id)
					throw new Error("message_id must belong to this conversation");
			}
			await ctx.db
				.updateTable("chat_conversation_members")
				.set({ last_read_message_id: messageId, last_read_at: new Date() })
				.where("conversation_id", "=", id)
				.where("user_id", "=", userId)
				.execute();
			fastify.bus.emit("io.twodb.chat.conversation.read", {
				workspace_id: workspaceId,
				conversation_id: id,
				user_id: userId,
				message_id: messageId,
			});
			return { read: true };
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});

	fastify.post("/messages/:id/actions", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const id = (request.params as { id: string }).id;
		const userId = principalOf(request).userId;
		const message = await ctx.db
			.selectFrom("chat_messages")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (
			!message ||
			!(await requireMember(
				fastify,
				ctx,
				message.conversation_id,
				workspaceId,
				userId,
			))
		)
			return reply.code(404).send({ error: "Message not found" });
		try {
			const body = (request.body ?? {}) as Record<string, unknown>;
			const actionId = text(body.action_id, "action_id", 100);
			if (
				!message.rich_blocks.some(
					(block) =>
						block.id === actionId &&
						(block.type === "button" || block.type === "input"),
				)
			) {
				throw new Error(
					"action_id must reference a button or input in this message",
				);
			}
			const actionIdValue = newId("chat-action");
			await ctx.db
				.insertInto("chat_message_actions")
				.values({
					id: actionIdValue,
					message_id: id,
					workspace_id: workspaceId,
					user_id: userId,
					action_id: actionId,
					value: jsonb(body.value ?? null),
				})
				.execute();
			const action = await ctx.db
				.selectFrom("chat_message_actions")
				.selectAll()
				.where("id", "=", actionIdValue)
				.executeTakeFirstOrThrow();
			const dto = toMessageActionDto(action);
			fastify.bus.emit("io.twodb.chat.message.actioned", {
				workspace_id: workspaceId,
				action: dto,
			});
			return reply.code(201).send({ action: dto });
		} catch (error) {
			return fail(reply, (error as Error).message);
		}
	});
}
