import { describe, expect, it } from "vitest";
import type { Kysely } from "kysely";
import {
	evaluateDisable,
	evaluateSignIn,
	getDeploymentMethod,
	getUserMethod,
	isVerificationCapable,
	methodAllowedByMode,
	rowState,
	canOfferChallenge,
	canCompleteChallenge,
	userVerified,
	type IdentityDB,
	type SignInInput,
	type UserRow,
} from "./methods";

const VERIFIED = {
	email_verified_at: new Date(),
	phone_verified_at: new Date(),
};
const UNVERIFIED = { email_verified_at: null, phone_verified_at: null };

function input(overrides: Partial<SignInInput> = {}): SignInInput {
	return {
		method: "password",
		mode: "email",
		requireVerified: false,
		deploymentEnabled: true,
		userMethodEnabled: true,
		user: VERIFIED,
		...overrides,
	};
}

const USR: UserRow = {
	id: "usr-1",
	identifier: "a@b.test",
	email: "a@b.test",
	phone: null,
	name: "A",
	email_verified_at: null,
	phone_verified_at: null,
	created_at: new Date(),
};

describe("methodAllowedByMode", () => {
	it("phone_otp needs a phone mode", () => {
		expect(methodAllowedByMode("phone_otp", "email")).toBe(false);
		expect(methodAllowedByMode("phone_otp", "phone")).toBe(true);
		expect(methodAllowedByMode("phone_otp", "email+phone")).toBe(true);
	});
	it("email_link needs an email mode", () => {
		expect(methodAllowedByMode("email_link", "phone")).toBe(false);
		expect(methodAllowedByMode("email_link", "email")).toBe(true);
		expect(methodAllowedByMode("email_link", "email+phone")).toBe(true);
	});
	it("password and sso.* work in every mode", () => {
		for (const mode of ["email", "phone", "email+phone"] as const) {
			expect(methodAllowedByMode("password", mode)).toBe(true);
			expect(methodAllowedByMode("sso.google", mode)).toBe(true);
		}
	});
});

describe("userVerified", () => {
	it("email mode needs email_verified_at", () => {
		expect(
			userVerified(
				{ email_verified_at: new Date(), phone_verified_at: null },
				"email",
			),
		).toBe(true);
		expect(userVerified(UNVERIFIED, "email")).toBe(false);
	});
	it("phone mode needs phone_verified_at", () => {
		expect(
			userVerified(
				{ email_verified_at: null, phone_verified_at: new Date() },
				"phone",
			),
		).toBe(true);
		expect(userVerified(UNVERIFIED, "phone")).toBe(false);
	});
	it("email+phone needs both stamps", () => {
		expect(
			userVerified(
				{ email_verified_at: new Date(), phone_verified_at: null },
				"email+phone",
			),
		).toBe(false);
		expect(userVerified(VERIFIED, "email+phone")).toBe(true);
	});
});

describe("evaluateSignIn — both switches, mode rules, and the gate", () => {
	it("ok when everything is on", () => {
		expect(evaluateSignIn(input())).toEqual({ ok: true });
	});
	it("mode rules beat everything", () => {
		expect(
			evaluateSignIn(input({ method: "phone_otp", mode: "email" })),
		).toEqual({ ok: false, reason: "mode_disallowed" });
	});
	it("deployment withdrawal blocks sign-in", () => {
		expect(evaluateSignIn(input({ deploymentEnabled: false }))).toEqual({
			ok: false,
			reason: "deployment_disabled",
		});
	});
	it("a missing user row is not a method", () => {
		expect(evaluateSignIn(input({ userMethodEnabled: null }))).toEqual({
			ok: false,
			reason: "no_such_method",
		});
	});
	it("user-level off blocks sign-in", () => {
		expect(evaluateSignIn(input({ userMethodEnabled: false }))).toEqual({
			ok: false,
			reason: "user_disabled",
		});
	});
	it("gate on + unverified + password → verify_required", () => {
		expect(
			evaluateSignIn(input({ requireVerified: true, user: UNVERIFIED })),
		).toEqual({ ok: false, reason: "verify_required" });
	});
	it("gate on + unverified + verification-capable method → ok", () => {
		expect(
			evaluateSignIn(
				input({
					method: "email_link",
					requireVerified: true,
					user: UNVERIFIED,
				}),
			),
		).toEqual({ ok: true });
	});
	it("gate on + verified → ok", () => {
		expect(evaluateSignIn(input({ requireVerified: true }))).toEqual({
			ok: true,
		});
	});
	it("only email_link and phone_otp are verification-capable", () => {
		expect(isVerificationCapable("email_link")).toBe(true);
		expect(isVerificationCapable("phone_otp")).toBe(true);
		expect(isVerificationCapable("password")).toBe(false);
		expect(isVerificationCapable("sso.google")).toBe(false);
	});
});

describe("evaluateDisable — no self-lockout", () => {
	const methods = [
		{ id: "a", enabled: true },
		{ id: "b", enabled: true },
	];
	it("refuses to disable the last enabled method", () => {
		expect(evaluateDisable([{ id: "a", enabled: true }], "a")).toEqual({
			ok: false,
			error: "Add another sign-in method first.",
		});
	});
	it("allows disabling when another method stays on", () => {
		expect(evaluateDisable(methods, "a")).toEqual({ ok: true });
	});
	it("re-disabling an off method is a no-op", () => {
		expect(evaluateDisable([{ id: "a", enabled: false }], "a")).toEqual({
			ok: true,
		});
	});
	it("unknown method id is an error", () => {
		expect(evaluateDisable(methods, "zzz")).toEqual({
			ok: false,
			error: "That sign-in method was not found.",
		});
	});
});

describe("rowState", () => {
	it("absent for no row", () => {
		expect(rowState(undefined)).toEqual({ kind: "absent" });
	});
	it("enabled for an enabled row", () => {
		expect(rowState({ enabled: true })).toEqual({ kind: "enabled" });
	});
	it("disabled for an off row", () => {
		expect(rowState({ enabled: false })).toEqual({ kind: "disabled" });
	});
});

/**
 * Hand-rolled Kysely stub. The two DB helpers below (`getDeploymentMethod`,
 * `getUserMethod`) issue a fixed-shape chain: selectFrom().select().where()
 * [.where()].executeTakeFirst(). A promise that resolves to the supplied
 * row covers every test.
 */
function stubDb(
	deployment: { enabled: boolean } | undefined,
	userMethod: { enabled: boolean } | undefined,
): Kysely<IdentityDB> {
	return {
		selectFrom: (table: string) => {
			if (table === "deployment_auth_methods") {
				return {
					select: () => ({
						where: () => ({
							executeTakeFirst: async () => deployment,
						}),
					}),
				} as unknown as ReturnType<Kysely<IdentityDB>["selectFrom"]>;
			}
			if (table === "user_auth_methods") {
				return {
					select: () => ({
						where: () => ({
							where: () => ({
								executeTakeFirst: async () => userMethod,
							}),
						}),
					}),
				} as unknown as ReturnType<Kysely<IdentityDB>["selectFrom"]>;
			}
			throw new Error(`unexpected table ${table}`);
		},
	} as unknown as Kysely<IdentityDB>;
}

const DEPLOYED = { enabled: true, config: {} };
const WITHDRAWN = { enabled: false, config: {} };

describe("canOfferChallenge — issue a /auth/link or /auth/otp challenge", () => {
	it("rejects when the deployment withdrew the method", async () => {
		const verdict = await canOfferChallenge(
			stubDb(WITHDRAWN, undefined),
			"email_link",
			{
				mode: "email",
			},
		);
		expect(verdict).toEqual({ ok: false, reason: "deployment_disabled" });
	});
	it("rejects in phone mode for an email-capable method", async () => {
		const verdict = await canOfferChallenge(
			stubDb(DEPLOYED, undefined),
			"email_link",
			{
				mode: "phone",
			},
		);
		expect(verdict).toEqual({ ok: false, reason: "mode_disallowed" });
	});
	it("accepts when the deployment offers it", async () => {
		const verdict = await canOfferChallenge(
			stubDb(DEPLOYED, undefined),
			"email_link",
			{
				mode: "email",
			},
		);
		expect(verdict).toEqual({ ok: true });
	});
	it("does not look at the user's row at all (first-use semantics)", async () => {
		// The user-level switch is the callback's job; the POST should issue
		// a code regardless of what user_auth_methods looks like at this point.
		const verdict = await canOfferChallenge(
			stubDb(DEPLOYED, { enabled: false }),
			"email_link",
			{ mode: "email" },
		);
		expect(verdict).toEqual({ ok: true });
	});
});

describe("canCompleteChallenge — consume the code, sign the user in", () => {
	it("accepts when no user row exists (callback will create it)", async () => {
		const verdict = await canCompleteChallenge(
			stubDb(DEPLOYED, undefined),
			USR,
			"email_link",
			{ mode: "email" },
		);
		expect(verdict).toEqual({ ok: true });
	});
	it("rejects when the user has the method but disabled it", async () => {
		const verdict = await canCompleteChallenge(
			stubDb(DEPLOYED, { enabled: false }),
			USR,
			"email_link",
			{ mode: "email" },
		);
		expect(verdict).toEqual({ ok: false, reason: "user_disabled" });
	});
	it("accepts when the user has the method enabled", async () => {
		const verdict = await canCompleteChallenge(
			stubDb(DEPLOYED, { enabled: true }),
			USR,
			"email_link",
			{ mode: "email" },
		);
		expect(verdict).toEqual({ ok: true });
	});
	it("blocks on withdrawal regardless of user state", async () => {
		const verdict = await canCompleteChallenge(
			stubDb(WITHDRAWN, { enabled: true }),
			USR,
			"email_link",
			{ mode: "email" },
		);
		expect(verdict).toEqual({ ok: false, reason: "deployment_disabled" });
	});
});

describe("getDeploymentMethod / getUserMethod — undefined on miss", () => {
	it("getDeploymentMethod returns undefined when no row exists", async () => {
		expect(
			await getDeploymentMethod(stubDb(undefined, undefined), "nope"),
		).toBeUndefined();
	});
	it("getDeploymentMethod returns the row when present", async () => {
		const row = await getDeploymentMethod(
			stubDb(DEPLOYED, undefined),
			"email_link",
		);
		expect(row).toEqual(DEPLOYED);
	});
	it("getUserMethod returns undefined when no row exists", async () => {
		expect(
			await getUserMethod(stubDb(undefined, undefined), "usr-1", "email_link"),
		).toBeUndefined();
	});
	it("getUserMethod returns the row when present", async () => {
		const row = await getUserMethod(
			stubDb(undefined, { enabled: true }),
			"usr-1",
			"email_link",
		);
		expect(row?.enabled).toBe(true);
	});
});
