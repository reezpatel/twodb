import type { Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      PORT: number;
      STATIC_DIR: string;
      TWO_DB_WORK_DIR: string;

      TWODB_ADMIN_RP_ID: string;
      TWODB_ADMIN_ORIGIN: string;
      TWODB_ADMIN_SESSION_TTL_MS: number;

      DATABASE_URL: string;
      POSTGRES_POOL_SIZE: number;
      TWODB_API_ORIGIN: string;
    };
    db: Kysely<TwodbDatabase>;
  }
}
