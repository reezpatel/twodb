import "@fastify/cookie";
import { runPluginMigrations, typedDb } from "@twodb/shared-backend";
import { outboxPlugin } from "./lib/outbox/outbox";
import { seedDeploymentMethods } from "./lib/users/methods";
import { requireSuperadmin as makeRequireSuperadmin } from "./lib/admin/admin";
import type { AuthCtx } from "./lib/auth/ctx";
import { maybeSeedSuperadmin } from "./lib/auth/superadmin";
import fastifyPlugin from "fastify-plugin";
import { registerRoutes } from "./routes";
import { buildMigrations } from "./db/migrations";
import type { IdentifierMode, IdentityDB } from "./db/schema";

export const TwodbIdentityServiceManifest = {
  plugin: fastifyPlugin(async (fastify) => {
    const config = (
      fastify as unknown as {
        config: {
          TWODB_IDENTIFIER: IdentifierMode;
          TWODB_SUPERADMIN_EMAIL: string;
          TWODB_REQUIRE_VERIFIED: boolean;
          TWODB_API_ORIGIN: string;
        };
      }
    ).config;
    const mode = config.TWODB_IDENTIFIER;
    if (!["email", "phone", "email+phone"].includes(mode)) {
      throw new Error(
        `twodb.identity: TWODB_IDENTIFIER must be email | phone | email+phone, got "${mode}"`,
      );
    }

    const db = typedDb<IdentityDB>(fastify);
    await fastify.register(outboxPlugin);
    await runPluginMigrations(db, "twodb.identity", buildMigrations());
    await seedDeploymentMethods(db);

    const ctx: AuthCtx = {
      db,
      mode,
      requireVerified: config.TWODB_REQUIRE_VERIFIED,
      apiOrigin: config.TWODB_API_ORIGIN,
      superadminEmail: config.TWODB_SUPERADMIN_EMAIL,
    };
    registerRoutes(fastify, ctx);
    fastify.decorate("requireSuperadmin", makeRequireSuperadmin(fastify));

    await maybeSeedSuperadmin(db, fastify, config.TWODB_SUPERADMIN_EMAIL);
  }),
};

export const identityManifest = TwodbIdentityServiceManifest;
