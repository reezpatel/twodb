// Postgres Fastify plugin.
// Wraps @fastify/postgres (which itself wraps node-postgres) so the rest of
// the api can read/write Postgres through `fastify.pg` without owning the
// pool lifecycle.
//
// Adds to fastify:
//   fastify.pg.connect  - get a pooled client (err, client, release) cb style
//   fastify.pg.pool     - the underlying pg.Pool
//   fastify.pg.Client   - a bare pg.Client constructor
//   fastify.pg.query    - one-shot query helper (no transaction)
//   fastify.pg.transact - multi-statement transaction helper
//   fastify.pg.ping()   - connectivity probe (used by /health/ready)
//
// Config (from fastify.config, populated by fastify-env):
//   DATABASE_URL        - full postgres:// URI
//   POSTGRES_POOL_SIZE  - max pool size (default 10)
// Plugin options override config when provided (useful for tests).

import fp from "fastify-plugin";
import fastifyPostgres from "@fastify/postgres";

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{
 *   connectionString?: string,
 *   poolSize?: number,
 *   name?: string,
 * }} [opts]
 */
async function postgresPlugin(fastify, opts) {
	const cfg = fastify.config ?? {};
	const connectionString = opts?.connectionString ?? cfg.DATABASE_URL;
	const poolSize = opts?.poolSize ?? cfg.POSTGRES_POOL_SIZE ?? 10;

	if (!connectionString) {
		throw new Error("postgres plugin: DATABASE_URL is not set");
	}

	await fastify.register(fastifyPostgres, {
		connectionString,
		max: poolSize,
		// Allow opting into a named connection alongside the unnamed default.
		name: opts?.name,
	});

	// Connectivity probe used by /health/ready. Symmetric with memgraph.ping().
	// We don't actually run a query - borrowing a client from the pool is
	// itself proof that Postgres accepted the TCP/auth handshake. If the
	// server is down, pool.connect() rejects and the probe surfaces the error.
	// We attach `ping` to the existing `fastify.pg` decorator rather than
	// re-decorating, because @fastify/postgres already owns that name.
	fastify.pg.ping = async () => {
		const client = await fastify.pg.connect();
		client.release();
	};

	fastify.log.info(
		{ name: opts?.name ?? "default", poolSize },
		"postgres plugin registered",
	);
}

export default fp(postgresPlugin, {
	name: "twodb-postgres",
});
