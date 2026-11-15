import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import type { TwoDbConfig } from "../config.js";
import { isAllowedRedirect } from "./oauth.js";
import { OAuthError } from "./oauth.js";

/**
 * `twodb auth <url>` login flow (first-party, localhost-loopback only):
 *
 *   twodb CLI ──opens browser──▶ GET /cli/auth?code_challenge&redirect_uri&name
 *        (user is signed in on the TwoDB webapp; a consent page asks to mint a CLI API key)
 *   webapp ──POST /cli/authorize (session)──▶ one-time code (10 min)
 *        ──redirect──▶ http://127.0.0.1:<port>/cli-callback?code=…
 *   twodb CLI ──POST /cli/exchange {code, codeVerifier}──▶ workspace API key
 *
 * The exchange verifies PKCE + that the code's redirect is a loopback
 * address, then mints a workspace API key via the platform's api_key table.
 * Codes are stored hashed, single use — same discipline as oauth_code.
 */

const CODE_TTL_MS = 10 * 60_000;
const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
const b64url = (b: Buffer) => b.toString("base64url");

/** The CLI may only loop back to this machine — never an arbitrary origin. */
export function isLoopbackRedirect(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol !== "http:") return false;
  if (u.username || u.password || u.hash) return false;
  return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
}

export function createCliAuthFlow(db: Kysely<ControlPlaneDb>, config: TwoDbConfig, deps: { issueApiKey: (userId: string, name: string) => Promise<{ rawKey: string; workspaceId: string; workspaceName: string | null; userName: string | null }> }) {
  return {
    /** Mints a one-time CLI login code for an authenticated user. Returns the redirect to send the browser to. */
    async authorize(input: { userId: string; redirectUri: string; codeChallenge: string; keyName: string }) {
      if (!isLoopbackRedirect(input.redirectUri)) throw new OAuthError(400, "redirect_uri must be a loopback http address");
      if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) throw new OAuthError(400, "code_challenge must be a base64url SHA-256 (S256)");
      const keyName = input.keyName.trim().slice(0, 100) || "twodb-cli";
      const code = b64url(randomBytes(32));
      await db
        .insertInto("cli_code")
        .values({
          code_hash: sha256Hex(code),
          user_id: input.userId,
          code_challenge: input.codeChallenge,
          redirect_uri: input.redirectUri,
          key_name: keyName,
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
          used_at: null,
        })
        .execute();
      void db.deleteFrom("cli_code").where("expires_at", "<", new Date(Date.now() - 3600_000).toISOString()).execute().catch(() => {});
      const target = new URL(input.redirectUri);
      target.searchParams.set("code", code);
      return { redirectTo: target.toString() };
    },

    /** Consumes a code (single use) after verifying PKCE + loopback redirect; mints the workspace API key. */
    async exchange(input: { code: string; codeVerifier: string }): Promise<{ apiKey: string; info: { user: string; workspace: string; workspaceId: string } }> {
      const hash = sha256Hex(input.code);
      // Atomic single-use claim, then validate — same pattern as oauth_code.
      const claimed = await db
        .updateTable("cli_code")
        .set({ used_at: new Date().toISOString() })
        .where("code_hash", "=", hash)
        .where("used_at", "is", null)
        .returningAll()
        .executeTakeFirst();
      if (!claimed) throw new OAuthError(400, "invalid_grant");
      if (Date.parse(claimed.expires_at) <= Date.now()) throw new OAuthError(400, "invalid_grant");
      if (!isLoopbackRedirect(claimed.redirect_uri)) throw new OAuthError(400, "invalid_grant");
      const expected = Buffer.from(claimed.code_challenge);
      const actual = Buffer.from(b64url(createHash("sha256").update(input.codeVerifier).digest()));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new OAuthError(400, "invalid_grant");

      const issued = await deps.issueApiKey(claimed.user_id, claimed.key_name);
      return {
        apiKey: issued.rawKey,
        info: { user: issued.userName ?? "user", workspace: issued.workspaceName ?? "workspace", workspaceId: issued.workspaceId },
      };
    },
  };
}

export { OAuthError };
export { isAllowedRedirect };
