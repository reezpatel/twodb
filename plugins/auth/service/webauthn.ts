import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import type { FastifyRequest } from "fastify";

const RP_NAME = "twodb";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type AuthHostConfig = {
  TWODB_ADMIN_RP_ID: string;
  TWODB_ADMIN_ORIGIN: string;
  TWODB_ADMIN_SESSION_TTL_MS: number;
};

export const hostConfig = (request: FastifyRequest) => (request.server as unknown as { config: AuthHostConfig }).config;

const challenges = new Map<string, number>();

function issueChallenge(challenge: string): void {
  challenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
}

function consumeChallenge(challenge: string): boolean {
  const expires = challenges.get(challenge);
  challenges.delete(challenge);
  return expires !== undefined && expires > Date.now();
}

function rp(request: FastifyRequest) {
  const { TWODB_ADMIN_RP_ID, TWODB_ADMIN_ORIGIN } = hostConfig(request);
  return { rpID: TWODB_ADMIN_RP_ID, origin: TWODB_ADMIN_ORIGIN };
}

export async function registrationOptions(
  request: FastifyRequest,
  user: { id: string; email: string },
  name: string | undefined,
  excludeCredentials: { id: string; transports?: string[] }[],
) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp(request).rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: name?.trim() || user.email,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });
  issueChallenge(options.challenge);
  return options;
}

export async function verifyRegistration(request: FastifyRequest, response: RegistrationResponseJSON) {
  const { rpID, origin } = rp(request);
  return verifyRegistrationResponse({
    response,
    expectedChallenge: consumeChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
}

export async function authenticationOptions(request: FastifyRequest, allowCredentials: { id: string; transports?: string[] }[]) {
  const options = await generateAuthenticationOptions({
    rpID: rp(request).rpID,
    userVerification: "preferred",
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
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

type StoredPasskey = {
  credential_id: string;
  public_key: Buffer;
  counter: number;
  transports: string | null;
};

export async function verifyAuthentication(request: FastifyRequest, response: AuthenticationResponseJSON, passkey: StoredPasskey) {
  const { rpID, origin } = rp(request);
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
