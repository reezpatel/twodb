import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { SESSION_COOKIE } from "@twodb/contracts";
import type { PluginManifest, Principal } from "@twodb/contracts";
import { createSession, hashToken } from "@twodb/plugin-identity/sessions";
import type { IdentityDB } from "@twodb/plugin-identity/schema";
import { sql } from "kysely";

import { buildClaimCatalog, type ClaimCatalog } from "./catalog";
import { makeRequireClaim } from "./requireClaim";
import { makeRequireAppClaim } from "./requireAppClaim";
import { makeWithWorkspace } from "./withWorkspace";

const notesManifest: PluginManifest = {
	id: "twodb.notes",
	name: "Notes",
	version: "1.0.0",
	provides: { functions: [], routes: [] },
	emits: [],
	consumes: [],
	permissions: [
		"plugin.twodb.notes:note.create",
		"plugin.twodb.notes:note.read",
		"plugin.twodb.notes:note.edit",
		"plugin.twodb.notes:note.delete",
	],
};
const ledgerManifest: PluginManifest = {
	id: "ledger",
	name: "Ledger",
	version: "1.0.0",
	provides: { functions: [], routes: [] },
	emits: [],
	consumes: [],
	permissions: ["app.ledger:entry.create"],
};

let db: Kysely<IdentityDB>;
let catalog: ClaimCatalog;

async function resetData() {
	await sql`
		TRUNCATE TABLE entity_grants, role_claims, workspace_role_assignments,
			roles, workspace_members, workspaces, org_memberships, organizations,
			sessions, platform_admins, user_auth_methods, verification_codes, users
		RESTART IDENTITY CASCADE
	`.execute(db as unknown as Kysely<{ [k: string]: unknown }>);
}

async function insertUser(id: string, identifier: string): Promise<void> {
	await db
		.insertInto("users")
		.values({ id, identifier, name: id, email: identifier })
		.execute();
}

async function insertOrg(id: string, ownerId: string): Promise<void> {
	await db
		.insertInto("organizations")
		.values({ id, name: id, slug: id, created_by: ownerId })
		.execute();
	await db
		.insertInto("org_memberships")
		.values({ org_id: id, user_id: ownerId, is_admin: true })
		.execute();
}

async function insertWorkspace(
	id: string,
	orgId: string,
	memberIds: string[],
): Promise<void> {
	await db
		.insertInto("workspaces")
		.values({ id, org_id: orgId, name: id, slug: id })
		.execute();
	for (const userId of memberIds) {
		await db
			.insertInto("workspace_members")
			.values({ workspace_id: id, user_id: userId })
			.execute();
	}
}

async function insertRole(
	id: string,
	workspaceId: string,
	name: string,
	claims: string[],
	isSystem = false,
): Promise<void> {
	await db
		.insertInto("roles")
		.values({
			id,
			workspace_id: workspaceId,
			key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
			name,
			description: null,
			is_system: isSystem,
		})
		.execute();
	for (const claim of claims) {
		await db.insertInto("role_claims").values({ role_id: id, claim }).execute();
	}
}

async function assignRole(
	workspaceId: string,
	userId: string,
	roleId: string,
): Promise<void> {
	await db
		.insertInto("workspace_role_assignments")
		.values({
			id: `asg-${randomBytes(8).toString("base64url")}`,
			workspace_id: workspaceId,
			user_id: userId,
			role_id: roleId,
		})
		.execute();
}

async function grantEntity(
	workspaceId: string,
	userId: string,
	entityType: string,
	entityId: string,
	claims: string[],
): Promise<void> {
	await db
		.insertInto("entity_grants")
		.values({
			id: `grt-${randomBytes(8).toString("base64url")}`,
			workspace_id: workspaceId,
			user_id: userId,
			entity_type: entityType,
			entity_id: entityId,
			claims,
			granted_by: userId,
		})
		.execute();
}

async function makeSession(userId: string): Promise<string> {
	const { token } = await createSession(db, userId, "test");
	return token;
}

type AppDecorations = {
	db: Kysely<unknown>;
	claimCatalog: ClaimCatalog;
	requireClaim: ReturnType<typeof makeRequireClaim>;
	requireAppClaim: ReturnType<typeof makeRequireAppClaim>;
	withWorkspace: ReturnType<typeof makeWithWorkspace>;
};

async function buildApp() {
	const app = Fastify({ logger: false });
	const pool = new Pool({
		connectionString:
			process.env.TEST_DATABASE_URL ??
			process.env.DATABASE_URL ??
			"postgres://twodb:twodb@localhost:5432/twodb",
	});
	const kdb = new Kysely<IdentityDB>({
		dialect: new PostgresDialect({ pool }),
	});
	(app as unknown as { db: Kysely<unknown> }).db = kdb as unknown as Kysely<unknown>;
	await app.register(cookie);
	(app as unknown as { claimCatalog: ClaimCatalog }).claimCatalog = catalog;
	(app as unknown as { requireClaim: AppDecorations["requireClaim"] }).requireClaim =
		makeRequireClaim(catalog);
	(app as unknown as { requireAppClaim: AppDecorations["requireAppClaim"] }).requireAppClaim =
		makeRequireAppClaim(catalog);
	(app as unknown as { withWorkspace: AppDecorations["withWorkspace"] }).withWorkspace =
		makeWithWorkspace(app as unknown as FastifyInstance & { db: Kysely<unknown> });

	app.addHook("onRequest", async (request) => {
		(request as unknown as { principal: Principal | null }).principal = null;
		const token = request.cookies[SESSION_COOKIE];
		if (!token) return;
		const session = await kdb
			.selectFrom("sessions")
			.select(["user_id", "expires_at"])
			.where("token_hash", "=", hashToken(token))
			.executeTakeFirst();
		if (!session || session.expires_at < new Date()) return;
		const admin = await kdb
			.selectFrom("platform_admins")
			.select("user_id")
			.where("user_id", "=", session.user_id)
			.executeTakeFirst();
		(request as unknown as { principal: Principal }).principal = {
			userId: session.user_id,
			isSuperadmin: admin !== undefined,
		};
	});

	return app;
}

beforeAll(async () => {
	const url =
		process.env.TEST_DATABASE_URL ??
		process.env.DATABASE_URL ??
		"postgres://twodb:twodb@localhost:5432/twodb";
	process.env.TEST_DATABASE_URL = url;
	const pool = new Pool({ connectionString: url });
	db = new Kysely<IdentityDB>({
		dialect: new PostgresDialect({ pool }),
	});
	catalog = await buildClaimCatalog([notesManifest, ledgerManifest]);
});

afterAll(async () => {
	await db.destroy();
});

beforeEach(async () => {
	await resetData();
});

describe("withWorkspace + requireClaim", () => {
	it("rejects an undeclared claim at route registration time", async () => {
		const app = await buildApp();
		const checks = makeRequireClaim(catalog);
		expect(() =>
			checks(
				"plugin.unknown:nope" as never,
				{} as never,
			),
		).toThrow(/not declared in the claim catalog/);
		await app.close();
	});

	it("rejects an app claim used through requireClaim", async () => {
		const checks = makeRequireClaim(catalog);
		expect(() => checks("app.ledger:entry.create", {})).toThrow(
			/use requireAppClaim instead/,
		);
	});

	it("rejects a plugin claim used through requireAppClaim", async () => {
		const checks = makeRequireAppClaim(catalog);
		expect(() => checks("plugin.twodb.notes:note.create", {})).toThrow(
			/use requireClaim instead/,
		);
	});

	it("lets a reader read but not edit", async () => {
		await insertUser("usr-1", "a@x.test");
		await insertOrg("org-1", "usr-1");
		await insertWorkspace("wks-1", "org-1", ["usr-1"]);
		await insertRole("rol-1", "wks-1", "reader", [
			"plugin.twodb.notes:note.read",
		]);
		await assignRole("wks-1", "usr-1", "rol-1");

		const token = await makeSession("usr-1");
		const app = await buildApp();
		app.post(
			"/wks/:workspaceId/read",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.read"),
				],
			},
			async () => ({ ok: true }),
		);
		app.post(
			"/wks/:workspaceId/edit",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.edit"),
				],
			},
			async () => ({ ok: true }),
		);

		const read = await app.inject({
			method: "POST",
			url: "/wks/wks-1/read",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(read.statusCode).toBe(200);

		const edit = await app.inject({
			method: "POST",
			url: "/wks/wks-1/edit",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(edit.statusCode).toBe(403);
		await app.close();
	});

	it("a guest role with no role_claims resolves to zero claims", async () => {
		await insertUser("usr-1", "a@x.test");
		await insertOrg("org-1", "usr-1");
		await insertWorkspace("wks-1", "org-1", ["usr-1"]);
		await insertRole("rol-guest", "wks-1", "guest", []);
		await assignRole("wks-1", "usr-1", "rol-guest");

		const token = await makeSession("usr-1");
		const app = await buildApp();
		app.post(
			"/w/:workspaceId/anything",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.read"),
				],
			},
			async () => ({ ok: true }),
		);

		const res = await app.inject({
			method: "POST",
			url: "/w/wks-1/anything",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(res.statusCode).toBe(403);
		await app.close();
	});

	it("cross-workspace denial — claims in A do not authorize in B", async () => {
		await insertUser("usr-1", "a@x.test");
		await insertOrg("org-1", "usr-1");
		await insertWorkspace("wks-A", "org-1", ["usr-1"]);
		await insertWorkspace("wks-B", "org-1", []);
		await insertRole("rol-A", "wks-A", "reader", [
			"plugin.twodb.notes:note.read",
		]);
		await assignRole("wks-A", "usr-1", "rol-A");

		const token = await makeSession("usr-1");
		const app = await buildApp();
		app.post(
			"/wks/:workspaceId/read",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.read"),
				],
			},
			async () => ({ ok: true }),
		);

		const a = await app.inject({
			method: "POST",
			url: "/wks/wks-A/read",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-A" },
		});
		expect(a.statusCode).toBe(200);

		const b = await app.inject({
			method: "POST",
			url: "/wks/wks-B/read",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-B" },
		});
		expect(b.statusCode).toBe(403);
		await app.close();
	});

	it("grant union — entity_grants lifts a reader to editor on one note only", async () => {
		await insertUser("usr-1", "a@x.test");
		await insertOrg("org-1", "usr-1");
		await insertWorkspace("wks-1", "org-1", ["usr-1"]);
		await insertRole("rol-reader", "wks-1", "reader", [
			"plugin.twodb.notes:note.read",
		]);
		await assignRole("wks-1", "usr-1", "rol-reader");
		await grantEntity("wks-1", "usr-1", "note", "note-1", [
			"plugin.twodb.notes:note.edit",
		]);

		const token = await makeSession("usr-1");
		const app = await buildApp();
		app.post(
			"/notes/:id/edit",
			{
				preHandler: [
					app.withWorkspace({ entity: "workspaces", idParam: "id" }),
					app.requireClaim("plugin.twodb.notes:note.edit", {
						entity: "note",
						idParam: "id",
					}),
				],
			},
			async () => ({ ok: true }),
		);

		const allowed = await app.inject({
			method: "POST",
			url: "/notes/note-1/edit",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
		});
		expect(allowed.statusCode).toBe(403);

		const denied = await app.inject({
			method: "POST",
			url: "/notes/note-2/edit",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
		});
		expect(denied.statusCode).toBe(403);
		await app.close();
	});

	it("two roles union — a user with reader + editor gets the union of both", async () => {
		await insertUser("usr-1", "a@x.test");
		await insertOrg("org-1", "usr-1");
		await insertWorkspace("wks-1", "org-1", ["usr-1"]);
		await insertRole("rol-read", "wks-1", "reader", [
			"plugin.twodb.notes:note.read",
		]);
		await insertRole("rol-edit", "wks-1", "editor", [
			"plugin.twodb.notes:note.edit",
		]);
		await assignRole("wks-1", "usr-1", "rol-read");
		await assignRole("wks-1", "usr-1", "rol-edit");

		const token = await makeSession("usr-1");
		const app = await buildApp();
		app.post(
			"/x/:workspaceId/read",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.read"),
				],
			},
			async () => ({ ok: true }),
		);
		app.post(
			"/x/:workspaceId/edit",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.edit"),
				],
			},
			async () => ({ ok: true }),
		);
		app.post(
			"/x/:workspaceId/delete",
			{
				preHandler: [
					app.withWorkspace({ workspaceIdBody: "ignored" }),
					app.requireClaim("plugin.twodb.notes:note.delete"),
				],
			},
			async () => ({ ok: true }),
		);

		const r1 = await app.inject({
			method: "POST",
			url: "/x/wks-1/read",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(r1.statusCode).toBe(200);
		const r2 = await app.inject({
			method: "POST",
			url: "/x/wks-1/edit",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(r2.statusCode).toBe(200);
		const r3 = await app.inject({
			method: "POST",
			url: "/x/wks-1/delete",
			headers: { cookie: `${SESSION_COOKIE}=${token}` },
			payload: { ignored: "wks-1" },
		});
		expect(r3.statusCode).toBe(403);
		await app.close();
	});
});
