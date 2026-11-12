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
  /**
   * First-run bootstrap: allow sessionless passkey registration when the
   * instance has no users yet. The user id is baked into the WebAuthn
   * challenge (and becomes the passkey's userId), so the user row is
   * created at options-GENERATION time, not verify time — a cancelled
   * ceremony can therefore leave an orphan user with no passkey; apps
   * should sweep those on boot (see apps/twodb/src/auth/index.ts).
   * Registration closes itself as soon as a user WITH a passkey exists.
   */
  firstUserBootstrap?: {
    hasUsers: () => Promise<boolean>;
    /**
     * Returns the user id for this bootstrap email, creating the row on
     * first use. MUST be idempotent: a cancelled ceremony leaves an orphan
     * user (no passkey bound) that the boot-time sweep hasn't removed yet,
     * so a retry must reuse that row, not hit the email unique constraint.
     */
    ensureUser: (email: string) => Promise<{ id: string; name: string; displayName: string }>;
  };
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
      registration: options.firstUserBootstrap
        ? {
            requireSession: false,
            resolveUser: async ({ context }) => {
              // Once any user WITH a passkey exists, bootstrap is closed —
              // defer to the session the plugin itself resolved.
              if (await options.firstUserBootstrap!.hasUsers()) {
                throw new Error("Registration is closed — sign in with your passkey (or ask an admin to enable open sign-up).");
              }
              // Zero-user bootstrap: create the real user NOW. The id is
              // baked into the WebAuthn challenge cookie and becomes the
              // passkey's userId at verify time, so a placeholder here
              // would 500 the verify call. Orphan users (ceremony cancelled)
              // are swept on boot by the app. The email arrives via the
              // plugin's declared `context` query param (its Zod schema
              // strips unknown query keys).
              const email = (context ?? "").trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("a valid email is required");
              // Idempotent across cancelled ceremonies: a prior options call
              // may have already created this user (passkey never completed,
              // so the boot sweep hasn't run). Reuse it rather than hitting
              // the email unique constraint.
              return options.firstUserBootstrap!.ensureUser(email);
            },
          }
        : undefined,
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
