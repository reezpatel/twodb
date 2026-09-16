import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { App, AdminPasskeyRow } from "./types";

const RP_NAME = "twodb admin";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Single-process challenge store. Challenges are keyed by their own value
// and expire after CHALLENGE_TTL_MS.
const challenges = new Map<string, number>();

function issueChallenge(challenge: string): void {
	challenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
}

function consumeChallenge(challenge: string): boolean {
	const expires = challenges.get(challenge);
	challenges.delete(challenge);
	return expires !== undefined && expires > Date.now();
}

function rp(app: App) {
	return {
		rpID: app.config.TWODB_ADMIN_RP_ID,
		origin: app.config.TWODB_ADMIN_ORIGIN,
	};
}

export async function registrationOptions(
	app: App,
	excludeCredentials: { id: string; transports?: string[] }[],
) {
	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: rp(app).rpID,
		userName: "admin",
		userDisplayName: "Admin",
		attestationType: "none",
		excludeCredentials,
		// Discoverable credential so login works without allowCredentials.
		authenticatorSelection: {
			residentKey: "required",
			userVerification: "preferred",
		},
	});
	issueChallenge(options.challenge);
	return options;
}

export async function verifyRegistration(
	app: App,
	response: RegistrationResponseJSON,
) {
	const { rpID, origin } = rp(app);
	return verifyRegistrationResponse({
		response,
		expectedChallenge: consumeChallenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
	});
}

export async function authenticationOptions(app: App) {
	const options = await generateAuthenticationOptions({
		rpID: rp(app).rpID,
		userVerification: "preferred",
	});
	issueChallenge(options.challenge);
	return options;
}

function parseTransports(raw: string | null): string[] | undefined {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as string[];
	} catch {
		return undefined;
	}
}

export async function verifyAuthentication(
	app: App,
	response: AuthenticationResponseJSON,
	passkey: AdminPasskeyRow,
) {
	const { rpID, origin } = rp(app);
	return verifyAuthenticationResponse({
		response,
		expectedChallenge: consumeChallenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		credential: {
			id: passkey.credential_id,
			publicKey: new Uint8Array(passkey.public_key),
			counter: passkey.counter,
			transports: parseTransports(passkey.transports),
		},
	});
}
