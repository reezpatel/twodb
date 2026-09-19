import type { TwodbDatabase } from "@twodb/shared-backend";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";

interface PostgresPluginOptions {
  connectionString?: string;
  poolSize?: number;
  name?: string;
}

const postgresPlugin: FastifyPluginAsync<PostgresPluginOptions> = async (fastify, opts) => {
  const cfg = fastify.config ?? {};
  const connectionString = opts?.connectionString ?? cfg.TWODB_DATABASE_URL;
  const poolSize = opts?.poolSize ?? cfg.TWODB_POSTGRES_POOL_SIZE ?? 10;

  if (!connectionString) {
    throw new Error("postgres plugin: TWODB_DATABASE_URL is not set");
  }

  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: poolSize,
    }),
  });

  const db = new Kysely<TwodbDatabase>({
    dialect,
  });

  fastify.decorate("db", db);
};

export default fp(postgresPlugin, {
  name: "twodb-postgres",
});
