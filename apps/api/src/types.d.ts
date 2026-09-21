import type { Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      TWODB_PORT: number;
      TWODB_STATIC_DIR: string;
      TWODB_VENDOR_DIR: string;
      TWODB_PLUGINS_DIR: string;
      TWODB_WORK_DIR: string;

      TWODB_ADMIN_RP_ID: string;
      TWODB_ADMIN_ORIGIN: string;
      TWODB_ADMIN_SESSION_TTL_MS: number;

      TWODB_DATABASE_URL: string;
      TWODB_POSTGRES_POOL_SIZE: number;
      TWODB_API_ORIGIN: string;
    };
    db: Kysely<TwodbDatabase>;
  }
}
