import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId, pluginSchemaName } from "@twodb/shared-backend";
import { sql } from "kysely";
import type { StorageCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toLocationDto, type LocationRow } from "../lib/serialize";
import { sanitizeName, sanitizePrefix } from "../lib/paths";
import { backendFor } from "../storage";

type LocationParams = { id: string };

type S3CredentialsBody = {
	access_key_id?: string;
	secret_access_key?: string;
	session_token?: string;
};

type LocationBody = {
	name?: string;
	kind?: string;
	node?: { node_id?: string; root_path?: string } | null;
	s3?: {
		bucket?: string;
		region?: string | null;
		endpoint?: string | null;
		prefix?: string;
		force_path_style?: boolean;
		credentials?: S3CredentialsBody | null;
	} | null;
};

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

const isUniqueViolation = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: string }).code === "23505";

async function nodeExists(
	ctx: StorageCtx,
	nodeId: string,
	workspaceId: string,
): Promise<boolean> {
	const schema = pluginSchemaName("io.twodb.node");
	const { rows } =
		await sql`select 1 from ${sql.id(`${schema}.node_nodes`)} where id = ${nodeId} and workspace_id = ${workspaceId} limit 1`.execute(
			ctx.db,
		);
	return rows.length > 0;
}

async function loadLocation(
	ctx: StorageCtx,
	id: string,
	workspaceId: string,
): Promise<LocationRow | undefined> {
	return ctx.db
		.selectFrom("storage_locations")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

export function registerLocationRoutes(
	fastify: TwodbFastifyInstance,
	ctx: StorageCtx,
): void {
	fastify.get("/locations", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const locations = await ctx.db
			.selectFrom("storage_locations")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("created_at", "asc")
			.execute();
		return { locations: locations.map(toLocationDto) };
	});

	fastify.post("/locations", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as LocationBody;

		try {
			const name = sanitizeName(body.name ?? "");
			const kind =
				body.kind === "s3" ? "s3" : body.kind === "node" ? "node" : null;
			if (!kind) throw new Error('kind must be "node" or "s3"');

			let nodeId: string | null = null;
			let rootPath = ".";
			let bucket: string | null = null;
			let region: string | null = null;
			let endpoint: string | null = null;
			let prefix = "";
			let forcePathStyle = ctx.s3Defaults.forcePathStyle;
			let credentialsEncrypted: string | null = null;

			if (kind === "node") {
				const target = body.node?.node_id?.trim();
				if (!target) throw new Error("node.node_id is required");
				if (!(await nodeExists(ctx, target, workspaceId))) {
					throw new Error("node not found");
				}
				nodeId = target;
				rootPath = sanitizePrefix(body.node?.root_path) || ".";
			} else {
				bucket = body.s3?.bucket?.trim() ?? "";
				if (!bucket) throw new Error("s3.bucket is required");
				region = body.s3?.region?.trim() || ctx.s3Defaults.region;
				endpoint =
					body.s3?.endpoint === null
						? null
						: body.s3?.endpoint?.trim() || ctx.s3Defaults.endpoint;
				prefix = sanitizePrefix(body.s3?.prefix);
				forcePathStyle =
					typeof body.s3?.force_path_style === "boolean"
						? body.s3.force_path_style
						: ctx.s3Defaults.forcePathStyle;
				const creds = body.s3?.credentials;
				if (creds) {
					if (
						!creds.access_key_id?.trim() ||
						!creds.secret_access_key?.trim()
					) {
						throw new Error(
							"s3.credentials needs access_key_id and secret_access_key",
						);
					}
					credentialsEncrypted = ctx.secrets.encrypt({
						access_key_id: creds.access_key_id.trim(),
						secret_access_key: creds.secret_access_key.trim(),
						...(creds.session_token?.trim()
							? { session_token: creds.session_token.trim() }
							: {}),
					});
				}
			}

			const id = newId("loc");
			await ctx.db
				.insertInto("storage_locations")
				.values({
					id,
					workspace_id: workspaceId,
					name,
					kind,
					node_id: nodeId,
					root_path: rootPath,
					bucket,
					region,
					endpoint,
					prefix,
					force_path_style: forcePathStyle,
					credentials_encrypted: credentialsEncrypted,
					created_by: principalOf(request).userId,
				})
				.execute();

			const row = await loadLocation(ctx, id, workspaceId);
			if (!row) return reply.code(500).send({ error: "insert failed" });
			ctx.emit("io.twodb.storage.location.created", {
				location_id: id,
				workspace_id: workspaceId,
			});
			return reply.code(201).send({ location: toLocationDto(row) });
		} catch (error) {
			if (isUniqueViolation(error)) {
				return reply
					.code(409)
					.send({ error: "a location with this name already exists" });
			}
			return badRequest(reply, error);
		}
	});

	fastify.get("/locations/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as LocationParams;
		const row = await loadLocation(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "location not found" });
		return { location: toLocationDto(row) };
	});

	fastify.patch("/locations/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as LocationParams;
		const body = (request.body ?? {}) as LocationBody;

		const existing = await loadLocation(ctx, id, workspaceId);
		if (!existing) return reply.code(404).send({ error: "location not found" });

		try {
			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.name !== undefined) updates.name = sanitizeName(body.name);
			if (body.node !== undefined && body.node !== null) {
				if (existing.kind !== "node") {
					throw new Error("location is not node-backed");
				}
				if (body.node.node_id !== undefined) {
					const target = body.node.node_id.trim();
					if (!target) throw new Error("node.node_id cannot be empty");
					if (!(await nodeExists(ctx, target, workspaceId))) {
						throw new Error("node not found");
					}
					updates.node_id = target;
				}
				if (body.node.root_path !== undefined) {
					updates.root_path = sanitizePrefix(body.node.root_path) || ".";
				}
			}
			if (body.s3 !== undefined && body.s3 !== null) {
				if (existing.kind !== "s3") {
					throw new Error("location is not s3-backed");
				}
				if (body.s3.bucket !== undefined) {
					const target = body.s3.bucket.trim();
					if (!target) throw new Error("s3.bucket cannot be empty");
					updates.bucket = target;
				}
				if (body.s3.region !== undefined) {
					updates.region = body.s3.region?.trim() || null;
				}
				if (body.s3.endpoint !== undefined) {
					updates.endpoint = body.s3.endpoint?.trim() || null;
				}
				if (body.s3.prefix !== undefined) {
					updates.prefix = sanitizePrefix(body.s3.prefix);
				}
				if (typeof body.s3.force_path_style === "boolean") {
					updates.force_path_style = body.s3.force_path_style;
				}
				if (body.s3.credentials !== undefined) {
					const creds = body.s3.credentials;
					updates.credentials_encrypted = creds
						? (() => {
								if (
									!creds.access_key_id?.trim() ||
									!creds.secret_access_key?.trim()
								) {
									throw new Error(
										"s3.credentials needs access_key_id and secret_access_key",
									);
								}
								return ctx.secrets.encrypt({
									access_key_id: creds.access_key_id.trim(),
									secret_access_key: creds.secret_access_key.trim(),
									...(creds.session_token?.trim()
										? { session_token: creds.session_token.trim() }
										: {}),
								});
							})()
						: null;
				}
			}

			await ctx.db
				.updateTable("storage_locations")
				.set(updates)
				.where("id", "=", id)
				.execute();

			const row = (await loadLocation(ctx, id, workspaceId)) ?? existing;
			ctx.emit("io.twodb.storage.location.updated", {
				location_id: id,
				workspace_id: workspaceId,
			});
			return { location: toLocationDto(row) };
		} catch (error) {
			if (isUniqueViolation(error)) {
				return reply
					.code(409)
					.send({ error: "a location with this name already exists" });
			}
			return badRequest(reply, error);
		}
	});

	fastify.delete("/locations/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as LocationParams;

		const usage = await ctx.db
			.selectFrom("storage_folders")
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.where("location_id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (Number(usage?.count ?? 0) > 0) {
			return reply.code(409).send({
				error: "location still backs root folders — delete or move them first",
			});
		}

		const result = await ctx.db
			.deleteFrom("storage_locations")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) {
			return reply.code(404).send({ error: "location not found" });
		}
		ctx.emit("io.twodb.storage.location.deleted", {
			location_id: id,
			workspace_id: workspaceId,
		});
		return { deleted: true };
	});

	fastify.post("/locations/:id/health", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as LocationParams;
		const row = await loadLocation(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "location not found" });
		try {
			await backendFor(row, fastify, ctx).health();
			return { status: "ok" };
		} catch (error) {
			return reply
				.code(502)
				.send({ status: "error", error: (error as Error).message });
		}
	});
}
