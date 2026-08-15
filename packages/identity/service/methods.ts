import type { Kysely, Selectable } from "kysely";
import { newId } from "@twodb/shared-backend";
import type {
	AuthCredential,
	DeploymentMethodConfig,
	IdentifierMode,
	IdentityDB,
	UsersTable,
} from "./schema";

export type { IdentityDB } from "./schema";

/* ------------------------------------------------------------------ *
 * The two-level method model, as pure functions — unit-tested without
 * HTTP (methods.test.ts). DB wrappers at the bottom just load rows and
 * call these.
 * ------------------------------------------------------------------ */

/** Methods that prove possession of an identifier simply by being used. */
const VERIFICATION_CAPABLE = new Set(["email_link", "phone_otp"]);

export function isVerificationCapable(method: string): boolean {
	return VERIFICATION_CAPABLE.has(method);
}

/**
 * Method availability follows the identifier mode: phone_otp needs a phone
 * mode, email_link needs an email mode; password and sso.* work everywhere.
 */
export function methodAllowedByMode(
	method: string,
	mode: IdentifierMode,
): boolean {
	if (method === "phone_otp") return mode !== "email";
	if (method === "email_link") return mode !== "phone";
	return true; // password, sso.*
}

/** Does the user hold the verified_at stamp(s) this deployment mode requires? */
export function userVerified(
	user: Pick<UsersTable, "email_verified_at" | "phone_verified_at">,
	mode: IdentifierMode,
): boolean {
	if (mode === "email") return user.email_verified_at !== null;
	if (mode === "phone") return user.phone_verified_at !== null;
	return user.email_verified_at !== null && user.phone_verified_at !== null;
}

export type SignInBlock =
	| "no_such_method" // user has no row for this method at all
	| "mode_disallowed" // method cannot exist in this identifier mode
	| "deployment_disabled" // superadmin withdrew the method
	| "user_disabled" // the user switched it off for themselves
	| "verify_required"; // gate is on, user unverified, method can't verify

export interface SignInInput {
	method: string;
	mode: IdentifierMode;
	requireVerified: boolean;
	deploymentEnabled: boolean;
	userMethodEnabled: boolean | null; // null = the user has no row for it
	user: Pick<UsersTable, "email_verified_at" | "phone_verified_at">;
}

/**
 * A method works only when both switches are on: the deployment offers it
 * AND the user has it enabled — plus mode rules and the verification gate.
 */
export function evaluateSignIn(
	input: SignInInput,
): { ok: true } | { ok: false; reason: SignInBlock } {
	if (!methodAllowedByMode(input.method, input.mode)) {
		return { ok: false, reason: "mode_disallowed" };
	}
	if (!input.deploymentEnabled) {
		return { ok: false, reason: "deployment_disabled" };
	}
	if (input.userMethodEnabled === null) {
		return { ok: false, reason: "no_such_method" };
	}
	if (!input.userMethodEnabled) {
		return { ok: false, reason: "user_disabled" };
	}
	if (
		input.requireVerified &&
		!userVerified(input.user, input.mode) &&
		!isVerificationCapable(input.method)
	) {
		return { ok: false, reason: "verify_required" };
	}
	return { ok: true };
}

/**
 * Whether the user has a user_auth_methods row for this method AND it is
 * enabled. Used by link/OTP sign-in flows where possession is proved by
 * the act of consuming the code — not by reading an existing row.
 */
export type RowState =
	| { kind: "absent" }
	| { kind: "enabled" }
	| { kind: "disabled" };

export function rowState(own: { enabled: boolean } | undefined): RowState {
	if (!own) return { kind: "absent" };
	return own.enabled ? { kind: "enabled" } : { kind: "disabled" };
}

/**
 * "May the deployment issue a /auth/link or /auth/otp challenge right now?"
 *
 * Skips the user-level `enabled` check on purpose — link/OTP sign-in itself
 * proves possession and implicitly creates a user_auth_methods row on
 * success. A user with an existing-but-disabled row is rejected, so we
 * never silently re-enable a method they turned off.
 */
export interface ChallengeGate {
	mode: IdentifierMode;
}

export async function canOfferChallenge(
	db: Kysely<IdentityDB>,
	method: string,
	gate: ChallengeGate,
): Promise<{ ok: true } | { ok: false; reason: SignInBlock }> {
	if (!methodAllowedByMode(method, gate.mode)) {
		return { ok: false, reason: "mode_disallowed" };
	}
	const deployment = await getDeploymentMethod(db, method);
	if (deployment?.enabled !== true) {
		return { ok: false, reason: "deployment_disabled" };
	}
	return { ok: true };
}

/**
 * "May the callback (consume the link/OTP code, sign the user in, create
 * the row on first use) proceed?" Differs from `evaluateSignIn` in two
 * ways:
 *   - a missing user_auth_methods row is allowed (it'll be created);
 *   - the verified-gate doesn't apply (link/OTP is verification itself).
 *
 * Used on the GET /auth/link/:token callback, /auth/otp/confirm, and
 * the SSO callback's first-sight path.
 */
export async function canCompleteChallenge(
	db: Kysely<IdentityDB>,
	user: UserRow,
	method: string,
	gate: ChallengeGate,
): Promise<{ ok: true } | { ok: false; reason: SignInBlock }> {
	const offer = await canOfferChallenge(db, method, gate);
	if (!offer.ok) return offer;
	const own = await getUserMethod(db, user.id, method);
	if (own && !own.enabled) {
		return { ok: false, reason: "user_disabled" };
	}
	return { ok: true };
}

/**
 * Refuse to disable the user's last enabled method — no self-lockout.
 * `methods` is the user's full user_auth_methods row set.
 */
export function evaluateDisable(
	methods: { id: string; enabled: boolean }[],
	methodId: string,
): { ok: true } | { ok: false; error: string } {
	const target = methods.find((m) => m.id === methodId);
	if (!target) return { ok: false, error: "That sign-in method was not found." };
	if (!target.enabled) return { ok: true }; // already off, nothing to do
	const othersEnabled = methods.some((m) => m.id !== methodId && m.enabled);
	if (!othersEnabled) {
		return { ok: false, error: "Add another sign-in method first." };
	}
	return { ok: true };
}

/* ------------------------------------------------------------------ *
 * DB-level wrappers
 * ------------------------------------------------------------------ */

export interface MethodRow {
	id: string;
	method: string;
	enabled: boolean;
	credential: AuthCredential;
	created_at: Date;
}

/** A users row as read from the database. */
export type UserRow = Selectable<UsersTable>;

export async function getUserMethod(
	db: Kysely<IdentityDB>,
	userId: string,
	method: string,
): Promise<MethodRow | undefined> {
	return db
		.selectFrom("user_auth_methods")
		.select(["id", "method", "enabled", "credential", "created_at"])
		.where("user_id", "=", userId)
		.where("method", "=", method)
		.executeTakeFirst();
}

export async function listUserMethods(
	db: Kysely<IdentityDB>,
	userId: string,
): Promise<MethodRow[]> {
	return db
		.selectFrom("user_auth_methods")
		.select(["id", "method", "enabled", "credential", "created_at"])
		.where("user_id", "=", userId)
		.orderBy("created_at")
		.execute();
}

export async function upsertUserMethod(
	db: Kysely<IdentityDB>,
	userId: string,
	method: string,
	credential: AuthCredential,
): Promise<void> {
	await db
		.insertInto("user_auth_methods")
		.values({
			id: newId("amt"),
			user_id: userId,
			method,
			credential,
			enabled: true,
		})
		.onConflict((oc) =>
			oc
				.columns(["user_id", "method"])
				.doUpdateSet({ credential, enabled: true }),
		)
		.execute();
}

export async function getDeploymentMethod(
	db: Kysely<IdentityDB>,
	method: string,
): Promise<
	| { method: string; enabled: boolean; config: DeploymentMethodConfig }
	| undefined
> {
	return db
		.selectFrom("deployment_auth_methods")
		.select(["method", "enabled", "config"])
		.where("method", "=", method)
		.executeTakeFirst();
}

/**
 * Seed a fresh deployment: password on, everything else off — so a new
 * instance behaves exactly like task 2 left it. Never overwrites config.
 */
export async function seedDeploymentMethods(
	db: Kysely<IdentityDB>,
): Promise<void> {
	for (const [method, enabled] of [
		["password", true],
		["email_link", false],
		["phone_otp", false],
	] as const) {
		await db
			.insertInto("deployment_auth_methods")
			.values({ method, config: {}, enabled })
			.onConflict((oc) => oc.column("method").doNothing())
			.execute();
	}
}

export async function explainSignIn(
	db: Kysely<IdentityDB>,
	user: UserRow,
	method: string,
	opts: { mode: IdentifierMode; requireVerified: boolean },
): Promise<{ ok: true } | { ok: false; reason: SignInBlock }> {
	const [deployment, own] = await Promise.all([
		getDeploymentMethod(db, method),
		getUserMethod(db, user.id, method),
	]);
	return evaluateSignIn({
		method,
		mode: opts.mode,
		requireVerified: opts.requireVerified,
		deploymentEnabled: deployment?.enabled ?? false,
		userMethodEnabled: own ? own.enabled : null,
		user,
	});
}

/** The login-identifier match, shared by password/link/otp/sso sign-in. */
export async function findUserByLoginIdentifier(
	db: Kysely<IdentityDB>,
	mode: IdentifierMode,
	value: string,
): Promise<UserRow | undefined> {
	return db
		.selectFrom("users")
		.selectAll()
		.where((eb) =>
			mode === "email+phone"
				? eb.or([eb("identifier", "=", value), eb("phone", "=", value)])
				: eb("identifier", "=", value),
		)
		.executeTakeFirst();
}
