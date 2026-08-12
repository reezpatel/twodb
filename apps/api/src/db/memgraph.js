// Memgraph Fastify plugin.
//
// Memgraph speaks the Bolt protocol - the same one Neo4j uses - so we use the
// official `neo4j-driver` JS package rather than a non-existent native plugin.
// This wraps the driver in a fastify-plugin so the rest of the api can reach
// the graph through `fastify.memgraph` without owning driver lifecycle.
//
// Adds to fastify:
//   fastify.memgraph.driver       - the underlying neo4j.Driver
//   fastify.memgraph.session()    - create a new session (caller closes it)
//   fastify.memgraph.executeRead(cypher, params)   - managed READ transaction
//   fastify.memgraph.executeWrite(cypher, params)  - managed WRITE transaction
//   fastify.memgraph.ping()       - connectivity probe (used by /health/ready)
//
// Config (from fastify.config, populated by fastify-env):
//   MEMGRAPH_URL         - bolt://host:port (or neo4j://, neo4j+s://)
//   MEMGRAPH_USER        - optional username (Memgraph is open by default)
//   MEMGRAPH_PASSWORD    - optional password
//   MEMGRAPH_DATABASE    - database name (Memgraph only has one)
//   MEMGRAPH_POOL_SIZE   - max pool size (default 50)
// Plugin options override config when provided.

import fp from "fastify-plugin";
import neo4j from "neo4j-driver";

/**
 * @typedef {{ records: any[], summary: any }} MemgraphResult
 */

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{
 *   url?: string,
 *   user?: string,
 *   password?: string,
 *   database?: string,
 *   poolSize?: number,
 * }} [opts]
 */
async function memgraphPlugin(fastify, opts) {
	const cfg = fastify.config ?? {};
	const url = opts?.url ?? cfg.MEMGRAPH_URL ?? "bolt://localhost:7687";
	const user = opts?.user ?? cfg.MEMGRAPH_USER ?? "";
	const password = opts?.password ?? cfg.MEMGRAPH_PASSWORD ?? "";
	const database = opts?.database ?? cfg.MEMGRAPH_DATABASE ?? "memgraph";
	const poolSize = opts?.poolSize ?? cfg.MEMGRAPH_POOL_SIZE ?? 50;

	const driver = neo4j.driver(
		url,
		// Memgraph with no auth requires *some* auth token - the empty string
		// basic token below is what neo4j-driver uses for unauthenticated Bolt.
		neo4j.auth.basic(user, password),
		{
			// Fail fast in dev - the api should not start if the graph is down.
			connectionTimeout: 5_000,
			maxConnectionPoolSize: poolSize,
			// Auto-enable TLS when the URL opts into it.
			encrypted: url.startsWith("neo4j+s") || url.startsWith("bolt+s"),
		},
	);

	// Verify reachability before handing control back; this surfaces a clear
	// error at boot instead of the first request.
	try {
		await driver.getServerInfo();
		fastify.log.info({ url, database, poolSize }, "memgraph driver connected");
	} catch (err) {
		await driver.close();
		throw new Error(
			`memgraph plugin: cannot reach ${url} - ${err.message ?? err}`,
		);
	}

	// Always close the driver when the fastify instance is shutting down.
	fastify.addHook("onClose", async () => {
		await driver.close();
		fastify.log.info("memgraph driver closed");
	});

	/**
	 * Open a session. Caller is responsible for `await session.close()`.
	 * @returns {neo4j.Session}
	 */
	const session = () => driver.session({ database });

	/**
	 * Run a Cypher statement inside a managed READ transaction.
	 * @param {string} cypher
	 * @param {Record<string, any>} [params]
	 * @returns {Promise<MemgraphResult>}
	 */
	const executeRead = async (cypher, params = {}) => {
		const session_ = driver.session({
			database,
			defaultAccessMode: neo4j.session.READ,
		});
		try {
			return await session_.executeRead((tx) => tx.run(cypher, params));
		} finally {
			await session_.close();
		}
	};

	/**
	 * Run a Cypher statement inside a managed WRITE transaction.
	 * @param {string} cypher
	 * @param {Record<string, any>} [params]
	 * @returns {Promise<MemgraphResult>}
	 */
	const executeWrite = async (cypher, params = {}) => {
		const session_ = driver.session({
			database,
			defaultAccessMode: neo4j.session.WRITE,
		});
		try {
			return await session_.executeWrite((tx) => tx.run(cypher, params));
		} finally {
			await session_.close();
		}
	};

	/** Lightweight connectivity probe for /health/ready. */
	const ping = async () => {
		await driver.verifyConnectivity();
	};

	fastify.decorate("memgraph", {
		driver,
		session,
		executeRead,
		executeWrite,
		ping,
	});

	fastify.log.info({ url, database }, "memgraph plugin registered");
}

export default fp(memgraphPlugin, {
	name: "twodb-memgraph",
});
