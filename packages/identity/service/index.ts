import "@fastify/cookie";
import type { Principal } from "@twodb/contracts";
import { SESSION_COOKIE } from "@twodb/contracts";
import {
	defineService,
	newId,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import identityManifest from "../manifest";
import type { IdentifierMode, IdentityDB } from "./schema";
import { buildMigrations } from "./migrations";
import {
	explainSignIn,
	findUserByLoginIdentifier,
	getDeploymentMethod,
	getUserMethod,
	seedDeploymentMethods,
	upsertUserMethod,
} from "./methods";
import { hashPassword, verifyPassword } from "./passwords";
import { seedWorkspaceRoles } from "./roles";
import { outboxPlugin } from "./outbox";
import { registerChallengeRoutes } from "./routes-challenges";
import { registerMethodRoutes } from "./routes-methods";
import { registerSsoRoutes } from "./routes-sso";
import { registerRoleRoutes } from "./routes-roles";
import { registerAssignmentRoutes } from "./routes-assignments";
import { registerGrantRoutes } from "./routes-grants";
import { registerMemberRoutes } from "./routes-members";
import { registerAppRoutes } from "./routes-apps";
import type { AuthCtx } from "./ctx";
import { destroySession } from "./sessions";
import { principalFor, startSession } from "./signin";

interface CredentialsBody {
	name?: string;
	email?: string;
	phone?: string;
	password?: string;
}

const PUBLIC = { config: { public: true } };
// Reachable for unverified sessions even when the verified-gate is on.
const VERIFY_EXEMPT = { config: { verifyExempt: true } };

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function validateCredentials(
	mode: IdentifierMode,
	body: CredentialsBody,
): { email: string | null; phone: string | null } | string {
	const email = body.email?.trim() ? normalizeEmail(body.email) : null;
	const phone = body.phone?.trim() || null;
	if (!body.password || body.password.length < 8) {
		return "Password needs at least 8 characters.";
	}
	if ((mode === "email" || mode === "email+phone") && !email) {
		return "An email address is required.";
	}
	if ((mode === "phone" || mode === "email+phone") && !phone) {
		return "A phone number is required.";
	}
	if (mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) {
		return "That doesn't look like an email address.";
	}
	return { email, phone };
}

export default defineService({
	id: "twodb.identity",
	async register(fastify) {
		const config = (
			fastify as unknown as {
				config: {
					TWODB_IDENTIFIER: IdentifierMode;
					TWODB_SUPERADMIN_EMAIL: string;
					TWODB_REQUIRE_VERIFIED: boolean;
					TWODB_API_ORIGIN: string;
				};
			}
		).config;
		const mode = config.TWODB_IDENTIFIER;
		if (!["email", "phone", "email+phone"].includes(mode)) {
			throw new Error(
				`twodb.identity: TWODB_IDENTIFIER must be email | phone | email+phone, got "${mode}"`,
			);
		}

		const db = typedDb<IdentityDB>(fastify);
		await fastify.register(outboxPlugin);
		await runPluginMigrations(db, "twodb.identity", buildMigrations());
		await seedDeploymentMethods(db);

		const ctx: AuthCtx = {
			db,
			mode,
			requireVerified: config.TWODB_REQUIRE_VERIFIED,
			apiOrigin: config.TWODB_API_ORIGIN,
		};
		registerChallengeRoutes(fastify, ctx);
		registerSsoRoutes(fastify, ctx);
		registerMethodRoutes(fastify, ctx);
		registerRoleRoutes(fastify);
		registerAssignmentRoutes(fastify);
		registerGrantRoutes(fastify);
		registerMemberRoutes(fastify);
		registerAppRoutes(fastify);

		async function maybeSeedSuperadmin(): Promise<void> {
			const email = config.TWODB_SUPERADMIN_EMAIL?.trim().toLowerCase();
			if (!email) return;
			const existing = await db
				.selectFrom("platform_admins")
				.select("user_id")
				.executeTakeFirst();
			if (existing) return;
			const user = await db
				.selectFrom("users")
				.select("id")
				.where((eb) =>
					eb.or([eb("identifier", "=", email), eb("email", "=", email)]),
				)
				.executeTakeFirst();
			if (!user) return;
			await db
				.insertInto("platform_admins")
				.values({ user_id: user.id, granted_by: null })
				.execute();
			fastify.log.info(`twodb.identity: ${email} is now superadmin`);
		}

		await maybeSeedSuperadmin();

		fastify.post("/auth/register", PUBLIC, async (request, reply) => {
			const body = request.body as CredentialsBody;
			const parsed = validateCredentials(mode, body);
			if (typeof parsed === "string") {
				return reply.code(400).send({ error: parsed });
			}
			if (!body.name?.trim()) {
				return reply.code(400).send({ error: "Your name is required." });
			}
			const passwordOffered = await getDeploymentMethod(db, "password");
			if (!passwordOffered?.enabled) {
				return reply.code(403).send({
					error: "Password sign-in is turned off on this server.",
				});
			}

			// One login key regardless of mode: email in the email modes, phone in
			// phone mode. The schema never bakes in the deployment mode, so the
			// mode can change without a migration.
			const identifier = mode === "phone" ? parsed.phone! : parsed.email!;
			if (mode === "email+phone" && parsed.phone) {
				const phoneTaken = await db
					.selectFrom("users")
					.select("id")
					.where("phone", "=", parsed.phone)
					.executeTakeFirst();
				if (phoneTaken) {
					return reply
						.code(409)
						.send({ error: "An account with these details already exists." });
				}
			}

			const userId = newId("usr");
			try {
				await db
					.insertInto("users")
					.values({
						id: userId,
						identifier,
						name: body.name.trim(),
						email: parsed.email,
						phone: parsed.phone,
					})
					.execute();
				await upsertUserMethod(db, userId, "password", {
					hash: await hashPassword(body.password!),
				});
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply
						.code(409)
						.send({ error: "An account with these details already exists." });
				}
				throw err;
			}

			fastify.bus.emit("twodb.identity.user.created", { userId });
			await maybeSeedSuperadmin();
			await startSession(fastify, reply, db, userId, "password");
			return reply
				.code(201)
				.send({ principal: { userId, isSuperadmin: false } });
		});

		fastify.post("/auth/login", PUBLIC, async (request, reply) => {
			const body = request.body as CredentialsBody;
			const identifier = body.email?.trim()
				? normalizeEmail(body.email)
				: (body.phone?.trim() ?? "");
			const generic = () =>
				reply
					.code(401)
					.send({ error: "Those sign-in details don't match." });

			const user = identifier
				? await findUserByLoginIdentifier(db, mode, identifier)
				: undefined;
			if (!user) return generic();

			const verdict = await explainSignIn(db, user, "password", ctx);
			if (!verdict.ok) {
				if (verdict.reason === "verify_required") {
					return reply.code(403).send({ error: "verify_required" });
				}
				return generic();
			}

			const method = await getUserMethod(db, user.id, "password");
			const hash = method?.credential.hash;
			if (!hash || !(await verifyPassword(body.password ?? "", hash))) {
				return generic();
			}

			await startSession(fastify, reply, db, user.id, "password");
			return { principal: request.principal ?? (await principalFor(db, user.id)) };
		});

		fastify.post("/auth/logout", VERIFY_EXEMPT, async (request, reply) => {
			const token = request.cookies[SESSION_COOKIE];
			if (token) await destroySession(db, token);
			reply.clearCookie(SESSION_COOKIE, { path: "/" });
			return { ok: true };
		});

		fastify.get("/auth/session", VERIFY_EXEMPT, async (request) => {
			return { principal: request.principal };
		});

		fastify.get("/me/memberships", async (request) => {
			const { userId } = request.principal as Principal;
			const orgs = await db
				.selectFrom("org_memberships")
				.innerJoin(
					"organizations",
					"organizations.id",
					"org_memberships.org_id",
				)
				.select([
					"organizations.id",
					"organizations.name",
					"organizations.slug",
					"organizations.created_by",
					"organizations.created_at",
					"org_memberships.is_admin",
				])
				.where("org_memberships.user_id", "=", userId)
				.execute();
			const workspaces = await db
				.selectFrom("workspace_members")
				.innerJoin(
					"workspaces",
					"workspaces.id",
					"workspace_members.workspace_id",
				)
				.innerJoin("organizations", "organizations.id", "workspaces.org_id")
				.select([
					"workspaces.id",
					"workspaces.org_id",
					"workspaces.name",
					"workspaces.slug",
					"workspaces.created_at",
					"organizations.name as org_name",
				])
				.where("workspace_members.user_id", "=", userId)
				.execute();
			return {
				orgs: orgs.map((o) => ({
					id: o.id,
					name: o.name,
					slug: o.slug,
					createdBy: o.created_by,
					createdAt: o.created_at,
					isAdmin: o.is_admin,
				})),
				workspaces: workspaces.map((w) => ({
					id: w.id,
					orgId: w.org_id,
					name: w.name,
					slug: w.slug,
					createdAt: w.created_at,
					orgName: w.org_name,
				})),
			};
		});

		fastify.post("/orgs", async (request, reply) => {
			const { userId } = request.principal as Principal;
			const body = request.body as { name?: string; slug?: string };
			if (!body.name?.trim() || !body.slug?.trim()) {
				return reply.code(400).send({ error: "Name and slug are required." });
			}
			const orgId = newId("org");
			try {
				await db
					.insertInto("organizations")
					.values({
						id: orgId,
						name: body.name.trim(),
						slug: body.slug.trim(),
						created_by: userId,
					})
					.execute();
				await db
					.insertInto("org_memberships")
					.values({ org_id: orgId, user_id: userId, is_admin: true })
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply
						.code(409)
						.send({ error: "That organization slug is taken." });
				}
				throw err;
			}
			fastify.bus.emit("twodb.identity.org.created", {
				orgId,
				ownerId: userId,
			});
			return reply.code(201).send({ orgId });
		});

		fastify.post("/workspaces", async (request, reply) => {
			const { userId } = request.principal as Principal;
			const body = request.body as {
				orgId?: string;
				name?: string;
				slug?: string;
			};
			if (!body.orgId || !body.name?.trim() || !body.slug?.trim()) {
				return reply
					.code(400)
					.send({ error: "orgId, name and slug are required." });
			}
			const membership = await db
				.selectFrom("org_memberships")
				.select("is_admin")
				.where("org_id", "=", body.orgId)
				.where("user_id", "=", userId)
				.executeTakeFirst();
			if (!membership?.is_admin) {
				return reply
					.code(403)
					.send({ error: "Only an organization admin can create workspaces." });
			}
			const installed =
				(fastify as unknown as { installedPluginManifests?: readonly import("@twodb/contracts").PluginManifest[] })
					.installedPluginManifests ?? [];
			const allManifests = installed.includes(identityManifest)
				? installed
				: [identityManifest, ...installed];
			const workspaceId = newId("wks");
			try {
				await db
					.insertInto("workspaces")
					.values({
						id: workspaceId,
						org_id: body.orgId,
						name: body.name.trim(),
						slug: body.slug.trim(),
					})
					.execute();
				await db
					.insertInto("workspace_members")
					.values({ workspace_id: workspaceId, user_id: userId })
					.execute();
				const roleIds = await seedWorkspaceRoles(
					db,
					workspaceId,
					fastify.claimCatalog.all,
					allManifests,
				);
				await db
					.insertInto("workspace_role_assignments")
					.values({
						id: newId("asg"),
						workspace_id: workspaceId,
						user_id: userId,
						role_id: roleIds.owner,
					})
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply
						.code(409)
						.send({
							error: "That workspace slug is taken in this organization.",
						});
				}
				throw err;
			}
			fastify.bus.emit("twodb.identity.workspace.created", {
				workspaceId,
				orgId: body.orgId,
			});
			fastify.bus.emit("twodb.identity.workspace.member.added", {
				workspaceId,
				userId,
			});
			fastify.bus.emit("twodb.identity.role.assigned", {
				workspaceId,
				userId,
				roleId: "owner",
			});
			return reply.code(201).send({ workspaceId });
		});

		fastify.get("/workspaces/:id/members", async (request, reply) => {
			const { userId } = request.principal as Principal;
			const { id } = request.params as { id: string };
			const membership = await db
				.selectFrom("workspace_members")
				.select("user_id")
				.where("workspace_id", "=", id)
				.where("user_id", "=", userId)
				.executeTakeFirst();
			if (!membership) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const members = await db
				.selectFrom("workspace_members")
				.innerJoin("users", "users.id", "workspace_members.user_id")
				.select([
					"users.id",
					"users.name",
					"users.email",
					"users.phone",
					"workspace_members.created_at",
				])
				.where("workspace_members.workspace_id", "=", id)
				.execute();
			return {
				members: members.map((m) => ({
					userId: m.id,
					name: m.name,
					email: m.email,
					phone: m.phone,
					joinedAt: m.created_at,
				})),
			};
		});
	},
});
