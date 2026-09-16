import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { StorageCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toFileDto, type FileRow } from "../lib/serialize";
import { contentDisposition, objectKey, sanitizeName } from "../lib/paths";
import { backendFor } from "../storage";
import type { FileKind } from "../../shared/types";

type FileParams = { id: string };

type FileBody = {
	name?: string;
	folder_id?: string;
};

/** Node-backed transfers are base64 inside the gateway's JSON protocol. */
export const NODE_MAX_FILE_BYTES = 48 * 1024 * 1024;

const SIGNED_URL_TTL_SEC = 900;
const SPREADSHEET_MIMES = [
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/csv",
];

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

const isUniqueViolation = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: string }).code === "23505";

async function loadFile(ctx: StorageCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("storage_files")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function loadFolder(ctx: StorageCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("storage_folders")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function loadLocation(ctx: StorageCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("storage_locations")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

/** the root folder row carrying the tree's location binding */
async function rootFolderOf(
	ctx: StorageCtx,
	rootId: string,
	workspaceId: string,
) {
	return loadFolder(ctx, rootId, workspaceId);
}

function stripClientPath(filename: string): string {
	const segments = filename.split(/[\\/]/);
	return segments[segments.length - 1] ?? filename;
}

function kindFilter(query: ReturnType<typeof createListQuery>, kind: FileKind) {
	if (kind === "pdf") {
		return query.where("mime_type", "=", "application/pdf");
	}
	if (kind === "spreadsheet") {
		return query.where("mime_type", "in", SPREADSHEET_MIMES);
	}
	if (kind === "image") {
		return query.where("mime_type", "like", "image/%");
	}
	// "document" is the catch-all bucket the scene uses for everything else
	return query.where((eb) =>
		eb.or([
			eb("mime_type", "like", "text/%"),
			eb.and([
				eb("mime_type", "!=", "application/pdf"),
				eb("mime_type", "not in", SPREADSHEET_MIMES),
				eb.not(eb("mime_type", "like", "image/%")),
			]),
		]),
	);
}

function createListQuery(ctx: StorageCtx) {
	return ctx.db.selectFrom("storage_files").selectAll();
}

export function registerFileRoutes(
	fastify: TwodbFastifyInstance,
	ctx: StorageCtx,
): void {
	fastify.post("/files", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;

		let folderId: string | null = null;
		const parts: { buffer: Buffer; filename: string; mimetype: string }[] = [];
		try {
			for await (const part of request.parts()) {
				if (part.type === "file") {
					parts.push({
						buffer: await part.toBuffer(),
						filename: part.filename,
						mimetype: part.mimetype,
					});
				} else if (part.fieldname === "folder_id") {
					folderId = String(part.value ?? "").trim() || null;
				}
			}
		} catch (error) {
			return reply
				.code(413)
				.send({ error: `upload rejected: ${(error as Error).message}` });
		}

		if (!folderId) return badRequest(reply, new Error("folder_id is required"));
		if (parts.length === 0)
			return badRequest(reply, new Error("no files given"));

		const folder = await loadFolder(ctx, folderId, workspaceId);
		if (!folder) return reply.code(404).send({ error: "folder not found" });
		const root = await rootFolderOf(ctx, folder.root_id, workspaceId);
		if (!root?.location_id) {
			return reply.code(409).send({ error: "folder has no storage location" });
		}
		const location = await loadLocation(ctx, root.location_id, workspaceId);
		if (!location) {
			return reply.code(409).send({ error: "storage location is gone" });
		}
		const backend = backendFor(location, fastify, ctx);

		const created: FileRow[] = [];
		for (const part of parts) {
			const name = sanitizeName(stripClientPath(part.filename));
			if (
				location.kind === "node" &&
				part.buffer.byteLength > NODE_MAX_FILE_BYTES
			) {
				return reply.code(413).send({
					error: `"${name}" exceeds the 48 MiB limit for node-backed locations`,
				});
			}
			const id = newId("file");
			const key = objectKey(folder.root_id, id);
			try {
				await ctx.db
					.insertInto("storage_files")
					.values({
						id,
						workspace_id: workspaceId,
						folder_id: folder.id,
						root_id: folder.root_id,
						name,
						storage_key: key,
						size: part.buffer.byteLength,
						mime_type: part.mimetype || "application/octet-stream",
						uploaded_by: principalOf(request).userId,
					})
					.execute();
			} catch (error) {
				if (isUniqueViolation(error)) {
					return reply
						.code(409)
						.send({ error: `"${name}" already exists in this folder` });
				}
				throw error;
			}
			try {
				const { etag } = await backend.put(key, part.buffer, {
					contentType: part.mimetype,
				});
				if (etag) {
					await ctx.db
						.updateTable("storage_files")
						.set({ etag })
						.where("id", "=", id)
						.execute();
				}
			} catch (error) {
				await ctx.db.deleteFrom("storage_files").where("id", "=", id).execute();
				await backend.delete(key).catch(() => undefined);
				return reply
					.code(502)
					.send({
						error: `storing "${name}" failed: ${(error as Error).message}`,
					});
			}
			const row = await loadFile(ctx, id, workspaceId);
			if (row) {
				created.push(row);
				ctx.emit("io.twodb.storage.file.uploaded", {
					file_id: id,
					workspace_id: workspaceId,
					folder_id: folder.id,
				});
			}
		}

		return reply.code(201).send({ files: created.map(toFileDto) });
	});

	fastify.get("/files", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const query = request.query as {
			folder_id?: string;
			kind?: string;
			q?: string;
			limit?: string;
			offset?: string;
		};

		let statement = createListQuery(ctx).where(
			"workspace_id",
			"=",
			workspaceId,
		);
		if (query.folder_id)
			statement = statement.where("folder_id", "=", query.folder_id);
		const kind =
			query.kind && query.kind !== "all" ? (query.kind as FileKind) : null;
		if (kind) statement = kindFilter(statement, kind);
		if (query.q?.trim()) {
			statement = statement.where("name", "ilike", `%${query.q.trim()}%`);
		}
		const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 500);
		const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
		const files = await statement
			.orderBy("name", "asc")
			.limit(limit)
			.offset(offset)
			.execute();
		return { files: files.map(toFileDto) };
	});

	fastify.get("/files/recent", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const limit = Math.min(
			Math.max(
				Number((request.query as { limit?: string }).limit ?? 8) || 8,
				1,
			),
			50,
		);
		const files = await ctx.db
			.selectFrom("storage_files")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy((eb) => eb.fn.coalesce("last_opened_at", "updated_at"), "desc")
			.limit(limit)
			.execute();
		return { files: files.map(toFileDto) };
	});

	fastify.get("/files/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FileParams;
		const row = await loadFile(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "file not found" });
		return { file: toFileDto(row) };
	});

	fastify.get("/files/:id/download", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FileParams;
		const file = await loadFile(ctx, id, workspaceId);
		if (!file) return reply.code(404).send({ error: "file not found" });

		const root = await rootFolderOf(ctx, file.root_id, workspaceId);
		if (!root?.location_id) {
			return reply.code(409).send({ error: "file has no storage location" });
		}
		const location = await loadLocation(ctx, root.location_id, workspaceId);
		if (!location) {
			return reply.code(409).send({ error: "storage location is gone" });
		}
		const backend = backendFor(location, fastify, ctx);

		// fire-and-forget: "recent" ordering prefers last_opened_at
		void ctx.db
			.updateTable("storage_files")
			.set({ last_opened_at: new Date() })
			.where("id", "=", id)
			.execute()
			.catch(() => undefined);

		const url = await backend.accessUrl(file.storage_key, {
			filename: file.name,
			expiresInSec: SIGNED_URL_TTL_SEC,
		});
		if (url) return reply.redirect(url, 302);

		try {
			const { data } = await backend.get(file.storage_key);
			return reply
				.header("content-type", file.mime_type)
				.header("content-length", data.byteLength)
				.header("content-disposition", contentDisposition(file.name))
				.send(data);
		} catch (error) {
			return reply
				.code(502)
				.send({ error: `fetching file failed: ${(error as Error).message}` });
		}
	});

	fastify.patch("/files/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FileParams;
		const body = (request.body ?? {}) as FileBody;

		const existing = await loadFile(ctx, id, workspaceId);
		if (!existing) return reply.code(404).send({ error: "file not found" });

		try {
			await ctx.db
				.updateTable("storage_files")
				.set({
					name: sanitizeName(body.name ?? ""),
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
		} catch (error) {
			if (isUniqueViolation(error)) {
				return reply
					.code(409)
					.send({ error: "a file with this name already exists here" });
			}
			return badRequest(reply, error);
		}

		const row = (await loadFile(ctx, id, workspaceId)) ?? existing;
		ctx.emit("io.twodb.storage.file.renamed", {
			file_id: id,
			workspace_id: workspaceId,
		});
		return { file: toFileDto(row) };
	});

	fastify.post("/files/:id/move", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FileParams;
		const body = (request.body ?? {}) as FileBody;

		if (!body.folder_id)
			return badRequest(reply, new Error("folder_id is required"));
		const file = await loadFile(ctx, id, workspaceId);
		if (!file) return reply.code(404).send({ error: "file not found" });
		const target = await loadFolder(ctx, body.folder_id, workspaceId);
		if (!target)
			return reply.code(404).send({ error: "target folder not found" });
		if (target.id === file.folder_id) return { file: toFileDto(file) };

		if (target.root_id === file.root_id) {
			await ctx.db
				.updateTable("storage_files")
				.set({ folder_id: target.id, updated_at: new Date() })
				.where("id", "=", id)
				.execute();
		} else {
			const fromRoot = await rootFolderOf(ctx, file.root_id, workspaceId);
			const toRoot = await rootFolderOf(ctx, target.root_id, workspaceId);
			if (!fromRoot?.location_id || !toRoot?.location_id) {
				return reply.code(409).send({ error: "tree has no storage location" });
			}
			const fromKey = file.storage_key;
			const toKey = objectKey(target.root_id, file.id);
			try {
				if (fromRoot.location_id === toRoot.location_id) {
					const location = await loadLocation(
						ctx,
						fromRoot.location_id,
						workspaceId,
					);
					if (!location) throw new Error("storage location is gone");
					await backendFor(location, fastify, ctx).move(fromKey, toKey);
				} else {
					const fromLocation = await loadLocation(
						ctx,
						fromRoot.location_id,
						workspaceId,
					);
					const toLocation = await loadLocation(
						ctx,
						toRoot.location_id,
						workspaceId,
					);
					if (!fromLocation || !toLocation) {
						throw new Error("storage location is gone");
					}
					const fromBackend = backendFor(fromLocation, fastify, ctx);
					const toBackend = backendFor(toLocation, fastify, ctx);
					const { data } = await fromBackend.get(fromKey);
					await toBackend.put(toKey, data, { contentType: file.mime_type });
					await fromBackend.delete(fromKey);
				}
			} catch (error) {
				return reply
					.code(502)
					.send({ error: `moving file failed: ${(error as Error).message}` });
			}
			await ctx.db
				.updateTable("storage_files")
				.set({
					folder_id: target.id,
					root_id: target.root_id,
					storage_key: toKey,
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
		}

		const row = (await loadFile(ctx, id, workspaceId)) ?? file;
		ctx.emit("io.twodb.storage.file.moved", {
			file_id: id,
			workspace_id: workspaceId,
			folder_id: target.id,
		});
		return { file: toFileDto(row) };
	});

	fastify.delete("/files/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FileParams;

		const file = await loadFile(ctx, id, workspaceId);
		if (!file) return reply.code(404).send({ error: "file not found" });

		try {
			const root = await rootFolderOf(ctx, file.root_id, workspaceId);
			if (root?.location_id) {
				const location = await loadLocation(ctx, root.location_id, workspaceId);
				if (location) {
					await backendFor(location, fastify, ctx).delete(file.storage_key);
				}
			}
		} catch (error) {
			request.log.warn(
				`storage: file ${id} backend delete failed: ${(error as Error).message}`,
			);
		}

		await ctx.db
			.deleteFrom("storage_files")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.execute();
		ctx.emit("io.twodb.storage.file.deleted", {
			file_id: id,
			workspace_id: workspaceId,
		});
		return { deleted: true };
	});
}
