import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import { sql } from "kysely";
import type { StorageCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import {
	toFolderDto,
	toFolderSummaryDto,
	type FolderRow,
} from "../lib/serialize";
import { sanitizeName } from "../lib/paths";
import { backendFor } from "../storage";
import type { BreadcrumbEntry } from "../../shared/types";

type FolderParams = { id: string };

type FolderBody = {
	name?: string;
	parent_id?: string | null;
	location_id?: string | null;
};

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

const isUniqueViolation = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: string }).code === "23505";

async function loadFolder(
	ctx: StorageCtx,
	id: string,
	workspaceId: string,
): Promise<FolderRow | undefined> {
	return ctx.db
		.selectFrom("storage_folders")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function loadLocationRow(
	ctx: StorageCtx,
	id: string,
	workspaceId: string,
) {
	return ctx.db
		.selectFrom("storage_locations")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function breadcrumbOf(
	ctx: StorageCtx,
	folder: FolderRow,
): Promise<BreadcrumbEntry[]> {
	const path: BreadcrumbEntry[] = [{ id: folder.id, name: folder.name }];
	let current = folder;
	for (let hop = 0; hop < 64 && current.parent_id; hop++) {
		const parent = await loadFolder(
			ctx,
			current.parent_id,
			folder.workspace_id,
		);
		if (!parent) break;
		path.unshift({ id: parent.id, name: parent.name });
		current = parent;
	}
	return path;
}

/** ids of `folderId` plus every descendant (recursive CTE over parent_id). */
async function subtreeIds(
	ctx: StorageCtx,
	folderId: string,
): Promise<string[]> {
	const { rows } = await sql`
		with recursive descend as (
			select id from io_twodb_storage.storage_folders where id = ${folderId}
			union all
			select f.id from io_twodb_storage.storage_folders f
			join descend d on f.parent_id = d.id
		)
		select id from descend
	`.execute(ctx.db);
	return rows.map((row) => String((row as { id: string }).id));
}

export function registerFolderRoutes(
	fastify: TwodbFastifyInstance,
	ctx: StorageCtx,
): void {
	fastify.get("/folders", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const parentId = (request.query as { parent_id?: string } | undefined)
			?.parent_id;

		if (parentId) {
			const parent = await loadFolder(ctx, parentId, workspaceId);
			if (!parent) return reply.code(404).send({ error: "folder not found" });
			const children = await ctx.db
				.selectFrom("storage_folders")
				.selectAll()
				.where("parent_id", "=", parentId)
				.where("workspace_id", "=", workspaceId)
				.orderBy("name", "asc")
				.execute();
			return { folders: children.map(toFolderDto) };
		}

		const rows = await ctx.db
			.selectFrom("storage_folders as f")
			.leftJoin("storage_files as fi", (join) =>
				join.on((eb) => eb("fi.root_id", "=", eb.ref("f.id"))),
			)
			.select((eb) => [
				"f.id",
				"f.workspace_id",
				"f.parent_id",
				"f.root_id",
				"f.location_id",
				"f.name",
				"f.created_by",
				"f.created_at",
				"f.updated_at",
				eb.fn.count(eb.ref("fi.id")).as("file_count"),
				eb.fn
					.coalesce(eb.fn.sum(eb.ref("fi.size")), eb.lit(0))
					.as("total_size"),
			])
			.where("f.workspace_id", "=", workspaceId)
			.where("f.parent_id", "is", null)
			.groupBy("f.id")
			.orderBy("f.name", "asc")
			.execute();

		return {
			folders: rows.map((row) =>
				toFolderSummaryDto(
					row as unknown as FolderRow,
					row.file_count as string | number,
					row.total_size as string | number,
				),
			),
		};
	});

	fastify.post("/folders", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as FolderBody;

		try {
			const name = sanitizeName(body.name ?? "");
			const id = newId("fld");

			if (body.parent_id) {
				const parent = await loadFolder(ctx, body.parent_id, workspaceId);
				if (!parent) throw new Error("parent folder not found");
				if (body.location_id) {
					throw new Error("only root folders pick a location");
				}
				await ctx.db
					.insertInto("storage_folders")
					.values({
						id,
						workspace_id: workspaceId,
						parent_id: parent.id,
						root_id: parent.root_id,
						location_id: null,
						name,
						created_by: principalOf(request).userId,
					})
					.execute();
			} else {
				// Root folder: this is where the client must answer
				// "where should this be stored?".
				if (!body.location_id) {
					throw new Error("location_id is required for root folders");
				}
				const location = await loadLocationRow(
					ctx,
					body.location_id,
					workspaceId,
				);
				if (!location) throw new Error("location not found");
				try {
					await ctx.db
						.insertInto("storage_folders")
						.values({
							id,
							workspace_id: workspaceId,
							parent_id: null,
							root_id: id,
							location_id: location.id,
							name,
							created_by: principalOf(request).userId,
						})
						.execute();
					if (location.kind === "node") {
						await backendFor(location, fastify, ctx).ensureDir(id);
					}
				} catch (error) {
					if (!isUniqueViolation(error)) throw error;
					throw new Error("a folder with this name already exists here");
				}
			}

			const row = await loadFolder(ctx, id, workspaceId);
			if (!row) return reply.code(500).send({ error: "insert failed" });
			ctx.emit("io.twodb.storage.folder.created", {
				folder_id: id,
				workspace_id: workspaceId,
			});
			return reply.code(201).send({ folder: toFolderDto(row) });
		} catch (error) {
			if (isUniqueViolation(error)) {
				return reply
					.code(409)
					.send({ error: "a folder with this name already exists here" });
			}
			return badRequest(reply, error);
		}
	});

	fastify.get("/folders/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FolderParams;
		const row = await loadFolder(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "folder not found" });
		return { folder: toFolderDto(row), path: await breadcrumbOf(ctx, row) };
	});

	fastify.patch("/folders/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FolderParams;
		const body = (request.body ?? {}) as FolderBody;

		const existing = await loadFolder(ctx, id, workspaceId);
		if (!existing) return reply.code(404).send({ error: "folder not found" });

		try {
			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.name !== undefined) updates.name = sanitizeName(body.name);
			await ctx.db
				.updateTable("storage_folders")
				.set(updates)
				.where("id", "=", id)
				.execute();
		} catch (error) {
			if (isUniqueViolation(error)) {
				return reply
					.code(409)
					.send({ error: "a folder with this name already exists here" });
			}
			return badRequest(reply, error);
		}

		const row = (await loadFolder(ctx, id, workspaceId)) ?? existing;
		ctx.emit("io.twodb.storage.folder.renamed", {
			folder_id: id,
			workspace_id: workspaceId,
		});
		return { folder: toFolderDto(row) };
	});

	fastify.delete("/folders/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as FolderParams;

		const folder = await loadFolder(ctx, id, workspaceId);
		if (!folder) return reply.code(404).send({ error: "folder not found" });

		try {
			if (folder.parent_id === null) {
				// root: keys share the `<folder_id>/` prefix — one bulk delete
				const root = await loadFolder(ctx, folder.root_id, workspaceId);
				if (root?.location_id) {
					const location = await loadLocationRow(
						ctx,
						root.location_id,
						workspaceId,
					);
					if (location) {
						await backendFor(location, fastify, ctx).deletePrefix(id);
					}
				}
			} else {
				// nested: collect exact keys for the subtree, batch delete
				const root = await loadFolder(ctx, folder.root_id, workspaceId);
				if (root?.location_id) {
					const location = await loadLocationRow(
						ctx,
						root.location_id,
						workspaceId,
					);
					if (location) {
						const ids = await subtreeIds(ctx, id);
						const files = await ctx.db
							.selectFrom("storage_files")
							.select(["storage_key"])
							.where("root_id", "=", folder.root_id)
							.where("folder_id", "in", ids)
							.execute();
						if (files.length > 0) {
							await backendFor(location, fastify, ctx).deleteMany(
								files.map((file) => file.storage_key),
							);
						}
					}
				}
			}
		} catch (error) {
			request.log.warn(
				`storage: folder ${id} backend cleanup failed: ${(error as Error).message}`,
			);
		}

		await ctx.db
			.deleteFrom("storage_folders")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.execute();

		ctx.emit("io.twodb.storage.folder.deleted", {
			folder_id: id,
			workspace_id: workspaceId,
		});
		return { deleted: true };
	});
}
