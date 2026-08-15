import { randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import {
	defineService,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import {
	registerSharingClaim,
	type Claim,
	type Note,
} from "@twodb/contracts";
import { buildMigrations } from "./migrations";
import type { NotesDB } from "./schema";
import manifest from "../manifest";

const READ_CLAIM = "plugin.twodb.notes:note.read" as const;

interface EntityGrantsTable {
	workspace_id: string;
	user_id: string;
	entity_type: string;
	entity_id: string;
	claims: readonly Claim[];
}

type NotesAndGrantsDB = NotesDB & { entity_grants: EntityGrantsTable };

/**
 * Notes service — task-06 dogfood for the authz engine.
 * Mounted at /api/v1/twodb.notes; persisted in postgres (`nte-…` ids).
 * Every route is claim-guarded. The list route is filtered by grants
 * so a guest with one note grant sees only that note.
 */
export default defineService({
	id: manifest.id,
	dependencies: [],
	async register(fastify) {
		registerSharingClaim("note", "plugin.twodb.notes:note.share");

		await runPluginMigrations(
			(fastify as unknown as { db: Kysely<unknown> }).db as Kysely<NotesDB>,
			"twodb.notes",
			buildMigrations(),
		);

		const requireClaim = fastify.requireClaim;
		const withWorkspace = fastify.withWorkspace;

		async function readNoteIdsForGrantOnlyReader(
			userId: string,
			workspaceId: string,
		): Promise<string[]> {
			const db = typedDb<NotesAndGrantsDB>(fastify);
			const rows = await db
				.selectFrom("entity_grants")
				.select(["entity_id", "claims"])
				.where("user_id", "=", userId)
				.where("workspace_id", "=", workspaceId)
				.where("entity_type", "=", "note")
				.execute();
			return rows
				.filter((r) => r.claims.includes(READ_CLAIM as Claim))
				.map((r) => r.entity_id);
		}

		function toNote(row: {
			id: string;
			title: string;
			body: string;
			created_by: string;
			created_at: Date;
			updated_at: Date;
		}): Note {
			return {
				id: row.id,
				title: row.title,
				body: row.body,
				createdAt: row.created_at.toISOString(),
				updatedAt: row.updated_at.toISOString(),
			};
		}

		fastify.get(
			"/notes",
			{
				preHandler: [
					withWorkspace({ workspaceIdQuery: "workspaceId" }),
				],
			},
			async (request) => {
				const ctx = request.workspaceContext!;
				const principal = request.principal!;
				const db = typedDb<NotesDB>(request.server);
				if (request.claims.has(READ_CLAIM)) {
					return db
						.selectFrom("notes")
						.selectAll()
						.where("workspace_id", "=", ctx.workspaceId)
						.orderBy("updated_at", "desc")
						.execute();
				}
				const ids = await readNoteIdsForGrantOnlyReader(
					principal.userId,
					ctx.workspaceId,
				);
				if (ids.length === 0) return [];
				return db
					.selectFrom("notes")
					.selectAll()
					.where("workspace_id", "=", ctx.workspaceId)
					.where("id", "in", ids)
					.orderBy("updated_at", "desc")
					.execute();
			},
		);

		fastify.post(
			"/notes",
			{
				preHandler: [
					withWorkspace({ workspaceIdBody: "workspaceId" }),
					requireClaim("plugin.twodb.notes:note.create"),
				],
			},
			async (request, reply) => {
				const ctx = request.workspaceContext!;
				const principal = request.principal!;
				const body = request.body as { title?: string; body?: string };
				const id = `nte-${randomBytes(8).toString("base64url")}`;
				const db = typedDb<NotesDB>(request.server);
				const now = new Date();
				await db
					.insertInto("notes")
					.values({
						id,
						workspace_id: ctx.workspaceId,
						title: body.title?.trim() || "Untitled",
						body: body.body ?? "",
						created_by: principal.userId,
						created_at: now,
						updated_at: now,
					})
					.execute();
				const row = await db
					.selectFrom("notes")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirstOrThrow();
				const note = toNote(row);
				fastify.bus.emit("twodb.notes.note.created", { note });
				return reply.code(201).send(note);
			},
		);

		fastify.get(
			"/notes/:id",
			{
				preHandler: [
					withWorkspace({ entity: "notes", idParam: "id" }),
					requireClaim("plugin.twodb.notes:note.read", {
						entity: "note",
						idParam: "id",
					}),
				],
			},
			async (request, reply) => {
				const db = typedDb<NotesDB>(request.server);
				const row = await db
					.selectFrom("notes")
					.selectAll()
					.where("id", "=", (request.params as { id: string }).id)
					.executeTakeFirst();
				if (!row) return reply.code(404).send({ error: "Note not found." });
				return toNote(row);
			},
		);

		fastify.patch(
			"/notes/:id",
			{
				preHandler: [
					withWorkspace({ entity: "notes", idParam: "id" }),
					requireClaim("plugin.twodb.notes:note.edit", {
						entity: "note",
						idParam: "id",
					}),
				],
			},
			async (request, reply) => {
				const { id } = request.params as { id: string };
				const db = typedDb<NotesDB>(request.server);
				const existing = await db
					.selectFrom("notes")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst();
				if (!existing) return reply.code(404).send({ error: "Note not found." });
				const body = request.body as { title?: string; body?: string };
				const now = new Date();
				const updated = {
					...existing,
					title: body.title ?? existing.title,
					body: body.body ?? existing.body,
					updated_at: now,
				};
				await db
					.updateTable("notes")
					.set({
						title: updated.title,
						body: updated.body,
						updated_at: now,
					})
					.where("id", "=", id)
					.execute();
				const note = toNote(updated);
				fastify.bus.emit("twodb.notes.note.updated", { note });
				return note;
			},
		);

		fastify.delete(
			"/notes/:id",
			{
				preHandler: [
					withWorkspace({ entity: "notes", idParam: "id" }),
					requireClaim("plugin.twodb.notes:note.delete", {
						entity: "note",
						idParam: "id",
					}),
				],
			},
			async (request, reply) => {
				const { id } = request.params as { id: string };
				const db = typedDb<NotesDB>(request.server);
				const deleted = await db
					.deleteFrom("notes")
					.where("id", "=", id)
					.returning("id")
					.executeTakeFirst();
				if (!deleted) return reply.code(404).send({ error: "Note not found." });
				fastify.bus.emit("twodb.notes.note.deleted", { noteId: id });
				return reply.code(204).send();
			},
		);
	},
});
