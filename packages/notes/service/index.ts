import { randomUUID } from "node:crypto";
import { defineService } from "@twodb/shared-backend";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@twodb/contracts";
import manifest from "../manifest";

/**
 * Notes service — the fastify half of the twodb.notes plugin.
 * Mounted by the api host at `/api/v1/twodb.notes`; every mutation is
 * published on the backend bus and mirrored to views over SSE.
 *
 * Storage is in-memory for the vertical slice; it moves to `fastify.pg`
 * (postgres) when the slice proves the shape.
 */
export default defineService({
	id: manifest.id,
	dependencies: [],
	async register(fastify) {
		const notes = new Map<string, Note>();

		fastify.get("/notes", async () => {
			return [...notes.values()].sort((a, b) =>
				b.updatedAt.localeCompare(a.updatedAt),
			);
		});

		fastify.post("/notes", async (request, reply) => {
			const input = request.body as CreateNoteInput;
			const now = new Date().toISOString();
			const note: Note = {
				id: randomUUID(),
				title: input.title?.trim() || "Untitled",
				body: input.body ?? "",
				createdAt: now,
				updatedAt: now,
			};
			notes.set(note.id, note);
			fastify.bus.emit("twodb.notes.note.created", { note });
			reply.code(201);
			return note;
		});

		fastify.get("/notes/:id", async (request, reply) => {
			const { id } = request.params as { id: string };
			const note = notes.get(id);
			if (!note) return reply.code(404).send({ error: "Note not found" });
			return note;
		});

		fastify.patch("/notes/:id", async (request, reply) => {
			const { id } = request.params as { id: string };
			const existing = notes.get(id);
			if (!existing) return reply.code(404).send({ error: "Note not found" });
			const input = request.body as UpdateNoteInput;
			const note: Note = {
				...existing,
				title: input.title ?? existing.title,
				body: input.body ?? existing.body,
				updatedAt: new Date().toISOString(),
			};
			notes.set(id, note);
			fastify.bus.emit("twodb.notes.note.updated", { note });
			return note;
		});

		fastify.delete("/notes/:id", async (request, reply) => {
			const { id } = request.params as { id: string };
			if (!notes.delete(id))
				return reply.code(404).send({ error: "Note not found" });
			fastify.bus.emit("twodb.notes.note.deleted", { noteId: id });
			reply.code(204).send();
		});
	},
});
