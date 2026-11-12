import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import type { TwoDbConfig } from "../config.js";

/**
 * First-party "Login with TwoDB" (OAuth 2.0 authorization-code + PKCE/S256).
 *
 *   app webapp ──redirect──▶ TwoDB webapp /authorize?redirect_uri&code_challenge&state
 *        (user signs in with passkey/Google/… on TwoDB, the one place credentials live)
 *   TwoDB webapp ──POST /registry/oauth/authorize (session)──▶ one-time code (60s)
 *        ──redirect──▶ app webapp ?code&state
 *   app webapp ──POST /registry/oauth/token {code, code_verifier, redirect_uri}──▶ session token
 *
 * The token is a regular better-auth session token: the gateway already
 * accepts it as `Authorization: Bearer <token>` for every route, so nothing
 * downstream changes. Codes are stored hashed, single use, bound to the
 * redirect URI and the PKCE challenge.
 */

const CODE_TTL_MS = 60_000;
const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
const b64url = (b: Buffer) => b.toString("base64url");

/** Allowed redirect targets: explicit list, trusted origins, and the 6500-6599 webapp band on a trusted host. */
export function isAllowedRedirect(uri: string, config: Pick<TwoDbConfig, "AUTH_TRUSTED_ORIGINS" | "TWODB_LOGIN_REDIRECT_ORIGINS">): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password || u.hash) return false;
  const explicit = [...config.AUTH_TRUSTED_ORIGINS, ...config.TWODB_LOGIN_REDIRECT_ORIGINS];
  if (explicit.some((o) => o === u.origin)) return true;
  return config.AUTH_TRUSTED_ORIGINS.some((o) => {
    try {
      const t = new URL(o);
      const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
      return t.protocol === u.protocol && t.hostname === u.hostname && port >= 6500 && port <= 6599;
    } catch {
      return false;
    }
  });
}

export function createOAuthFlow(db: Kysely<ControlPlaneDb>, config: TwoDbConfig) {
  return {
    /** Mints a one-time code for an authenticated user. Returns the redirect to send the browser to. */
    async authorize(input: { userId: string; redirectUri: string; codeChallenge: string; state?: string }) {
      if (!isAllowedRedirect(input.redirectUri, config)) throw new OAuthError(400, "redirect_uri is not an allowed origin");
      if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) throw new OAuthError(400, "code_challenge must be a base64url SHA-256 (S256)");
      const code = b64url(randomBytes(32));
      await db
        .insertInto("oauth_code")
        .values({
          code_hash: sha256Hex(code),
          user_id: input.userId,
          code_challenge: input.codeChallenge,
          redirect_uri: input.redirectUri,
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
          used_at: null,
        })
        .execute();
      // Opportunistic cleanup of dead codes.
      void db.deleteFrom("oauth_code").where("expires_at", "<", new Date(Date.now() - 3600_000).toISOString()).execute().catch(() => {});
      const target = new URL(input.redirectUri);
      target.searchParams.set("code", code);
      if (input.state) target.searchParams.set("state", input.state);
      return { redirectTo: target.toString() };
    },

    /** Consumes a code (single use) after verifying PKCE + redirect URI; returns the user id to mint a session for. */
    async redeem(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<{ userId: string }> {
      const hash = sha256Hex(input.code);
      // Atomic single-use: claim the row first, then validate — a replay (or a racing second
      // redemption) can never win the claim.
      const claimed = await db
        .updateTable("oauth_code")
        .set({ used_at: new Date().toISOString() })
        .where("code_hash", "=", hash)
        .where("used_at", "is", null)
        .returningAll()
        .executeTakeFirst();
      if (!claimed) throw new OAuthError(400, "invalid_grant");
      if (Date.parse(claimed.expires_at) <= Date.now()) throw new OAuthError(400, "invalid_grant");
      if (claimed.redirect_uri !== input.redirectUri) throw new OAuthError(400, "invalid_grant");
      const expected = Buffer.from(claimed.code_challenge);
      const actual = Buffer.from(b64url(createHash("sha256").update(input.codeVerifier).digest()));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new OAuthError(400, "invalid_grant");
      return { userId: claimed.user_id };
    },
  };
}

export class OAuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
