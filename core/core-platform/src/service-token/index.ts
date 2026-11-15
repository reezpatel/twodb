// Service tokens: short-lived EdDSA (Ed25519) JWTs the control plane issues so one app can call
// another on behalf of a workspace. The receiver trusts `wid` because the control plane signed it —
// never because a body or header said so. Pure node:crypto, no dependencies.
//
//   iss  "twodb"            sub  calling app slug        aud  receiving app slug
//   wid  workspace id       scp  message types / scopes  act  optional {type, id} attribution only
//   jti  unique id          iat/exp  seconds

import { createHash, createPrivateKey, createPublicKey, hkdfSync, randomUUID, sign, verify, type KeyObject } from "node:crypto";

export const SERVICE_TOKEN_ISSUER = "twodb";
export const SERVICE_TOKEN_TTL_SECONDS = 300;

/**
 * A token carrying this scope lets the gateway treat its holder as "this app, acting in workspace `wid`" toward the
 * audience app — what a headless run uses to call TwoRoute / Dispatch with no user and no stored API key. The control
 * plane only issues it for explicitly granted (caller → audience) pairs (TWODB_SERVICE_ACT_GRANTS).
 */
export const ACT_SCOPE = "gateway.act";

export interface ServiceTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  wid: string;
  scp: string[];
  act?: { type: string; id: string };
  jti: string;
  iat: number;
  exp: number;
}

export interface Jwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  alg: "EdDSA";
  use: "sig";
}

export class ServiceTokenError extends Error {}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// PKCS8 prefix for a raw 32-byte Ed25519 seed.
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/** The control plane derives its signing key from a secret it already has, so there is nothing extra to store or sync. */
export function deriveSigningKey(secret: string): { privateKey: KeyObject; publicKey: KeyObject; jwk: Jwk } {
  const seed = Buffer.from(hkdfSync("sha256", secret, "twodb", "twodb-service-token-v1", 32));
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: "der", type: "pkcs8" });
  const publicKey = createPublicKey(privateKey);
  const x = (publicKey.export({ format: "jwk" }) as { x: string }).x;
  const kid = createHash("sha256").update(x).digest("base64url").slice(0, 16);
  return { privateKey, publicKey, jwk: { kty: "OKP", crv: "Ed25519", x, kid, alg: "EdDSA", use: "sig" } };
}

export function signServiceToken(
  key: { privateKey: KeyObject; jwk: Jwk },
  input: { sub: string; aud: string; wid: string; scp?: string[]; act?: { type: string; id: string }; ttlSeconds?: number },
  now = Date.now(),
): { token: string; claims: ServiceTokenClaims } {
  const iat = Math.floor(now / 1000);
  const claims: ServiceTokenClaims = {
    iss: SERVICE_TOKEN_ISSUER,
    sub: input.sub,
    aud: input.aud,
    wid: input.wid,
    scp: input.scp ?? [],
    ...(input.act ? { act: input.act } : {}),
    jti: randomUUID(),
    iat,
    exp: iat + (input.ttlSeconds ?? SERVICE_TOKEN_TTL_SECONDS),
  };
  const header = { alg: "EdDSA", typ: "twodb-svc+jwt", kid: key.jwk.kid };
  const body = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(claims))}`;
  const sig = sign(null, Buffer.from(body), key.privateKey);
  return { token: `${body}.${b64u(sig)}`, claims };
}

/** Cheap shape check so callers can tell a service token from an API key / session token without verifying. */
export function looksLikeServiceToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[0], "base64url").toString()).typ === "twodb-svc+jwt";
  } catch {
    return false;
  }
}

export interface VerifyOptions {
  /** Public keys by kid (from the control plane's JWKS). */
  keys: Jwk[];
  /** This app's slug — the token must be addressed to it. */
  audience: string;
  /** When set, the token's `scp` must include this (e.g. the message type being delivered). */
  scope?: string;
  now?: number;
}

export function verifyServiceToken(token: string, opts: VerifyOptions): ServiceTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ServiceTokenError("malformed token");
  let header: { alg?: string; typ?: string; kid?: string };
  let claims: ServiceTokenClaims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    throw new ServiceTokenError("malformed token");
  }
  if (header.alg !== "EdDSA" || header.typ !== "twodb-svc+jwt") throw new ServiceTokenError("unsupported token type");
  const jwk = opts.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new ServiceTokenError("unknown signing key");
  const publicKey = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: "jwk" });
  const ok = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], "base64url"));
  if (!ok) throw new ServiceTokenError("bad signature");
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (claims.iss !== SERVICE_TOKEN_ISSUER) throw new ServiceTokenError("wrong issuer");
  if (claims.aud !== opts.audience) throw new ServiceTokenError("token is for another app");
  if (typeof claims.exp !== "number" || claims.exp < nowSec - 5) throw new ServiceTokenError("token expired");
  if (typeof claims.wid !== "string" || !claims.wid) throw new ServiceTokenError("token has no workspace");
  if (opts.scope && !claims.scp?.includes(opts.scope)) throw new ServiceTokenError(`token not scoped for ${opts.scope}`);
  return claims;
}
