import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, bearer, genericOAuth } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { apiKey as betterAuthApiKeyPlugin } from "@better-auth/api-key";
import type { Kysely } from "kysely";
import { ulid } from "ulid";

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
   * instance has no users yet. Registration closes itself as soon as the
   * first user exists. The plugin never creates the user row itself —
   * `createUser` must do that (called from afterVerification).
   */
  firstUserBootstrap?: {
    hasUsers: () => Promise<boolean>;
    /** Creates the user row; returns the new user's id. */
    createUser: (name: string) => Promise<string>;
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
            // Sessionless registration only while the instance has zero
            // users — after bootstrap this path closes itself. The user row
            // is created at verify time (afterVerification below), NOT here:
            // the options call happens before the authenticator ceremony,
            // and creating the user here would leave an orphan row if the
            // user cancels the OS prompt.
            resolveUser: async ({ ctx }) => {
              if (await options.firstUserBootstrap!.hasUsers()) {
                const session = await (ctx as any).context?.getSession?.(ctx);
                if (!session?.user) throw new Error("session required");
                return { id: session.user.id, name: session.user.name ?? "user", displayName: session.user.name };
              }
              // Placeholder id — replaced by the real one created in
              // afterVerification. Only used for the WebAuthn options payload.
              return { id: `bootstrap-${ulid()}`, name: "owner", displayName: "owner" };
            },
            afterVerification: async ({ ctx, user }) => {
              if (await options.firstUserBootstrap!.hasUsers()) return {};
              // First ever user: create the row now that the ceremony has
              // actually succeeded, then hand the real id back so the
              // passkey row (and the createSession login) bind to it.
              const body = (ctx as any).body ?? {};
              const name = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : user.name;
              const userId = await options.firstUserBootstrap!.createUser(name);
              return { userId, name };
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
