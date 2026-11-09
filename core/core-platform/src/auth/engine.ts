import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, bearer, genericOAuth } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { apiKey as betterAuthApiKeyPlugin } from "@better-auth/api-key";
import type { Kysely } from "kysely";

export interface AuthEngineOptions {
  /** Shared Kysely instance (TwoDB's own control-plane DB — SQLite by default). */
  db: Kysely<any>;
  dbType: "sqlite" | "pg";
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  passkey: { rpName: string; rpID: string; origin: string };
  google?: { clientId: string; clientSecret: string };
  /** PocketID (or any OIDC provider) via better-auth's generic OAuth plugin. */
  pocketId?: { issuer: string; clientId: string; clientSecret: string };
}

function buildOptions(options: AuthEngineOptions): BetterAuthOptions {
  const plugins: any[] = [
    admin(),
    passkey({
      rpName: options.passkey.rpName,
      rpID: options.passkey.rpID,
      origin: options.passkey.origin,
    }),
    betterAuthApiKeyPlugin(),
    // Native/desktop shells can't rely on cross-site cookies, so they carry
    // the session as a bearer token instead.
    bearer(),
  ];

  if (options.pocketId) {
    plugins.push(
      genericOAuth({
        config: [
          {
            providerId: "pocketid",
            clientId: options.pocketId.clientId,
            clientSecret: options.pocketId.clientSecret,
            discoveryUrl: `${options.pocketId.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
          },
        ],
      }),
    );
  }

  return {
    database: { db: options.db, type: options.dbType === "pg" ? "postgres" : "sqlite" },
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    // No email/password — passwordless only, per TwoAuth decision.
    emailAndPassword: { enabled: false },
    socialProviders: options.google
      ? {
          google: {
            clientId: options.google.clientId,
            clientSecret: options.google.clientSecret,
          },
        }
      : undefined,
    plugins,
  };
}

/**
 * The passwordless identity engine behind TwoAuth: passkeys + Google +
 * PocketID (generic OIDC) + workspace-level API keys (see repository.ts for
 * the workspace-scoping layer on top — this engine only knows about users/
 * sessions/credentials, not org/workspace/space).
 */
export function createAuthEngine(options: AuthEngineOptions) {
  return betterAuth(buildOptions(options));
}

/**
 * Creates/updates better-auth's own tables (`user`, `session`, `account`,
 * `verification`, `passkey`, `apikey`) against whatever DB `options.db`
 * points at. Safe to call on every boot — this is what gives TwoDB its
 * "bootstraps itself on first run, no setup step" property instead of
 * requiring `npx @better-auth/cli migrate` to be run by hand.
 */
export async function migrateAuthEngine(options: AuthEngineOptions): Promise<void> {
  const { runMigrations } = await getMigrations(buildOptions(options));
  await runMigrations();
}

export type AuthEngine = ReturnType<typeof createAuthEngine>;
