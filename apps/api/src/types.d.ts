// Ambient module/decorator declarations for the api host.
//
// The db plugins (src/db/*.js) are plain JS and decorate the fastify
// instance at runtime; @fastify/env populates `fastify.config` from the
// schema in src/config.js. Those decorations are declared here so the
// TypeScript host code can use them. Keep in sync with src/config.js and
// the db plugins.
//
// Note: `fastify.pg` is intentionally NOT redeclared here — @fastify/postgres
// already declares it, and our runtime `ping` helper is attached by
// src/db/postgres.js. Call sites assert the extension via `PgWithPing`.

interface MemgraphDecorator {
	/** Connectivity probe used by /health/ready. */
	ping: () => Promise<unknown>;
}

declare module "fastify" {
	interface FastifyInstance {
		config: {
			PORT: number;
			DATABASE_URL: string;
			POSTGRES_POOL_SIZE: number;
			MEMGRAPH_URL: string;
			MEMGRAPH_USER: string;
			MEMGRAPH_PASSWORD: string;
			MEMGRAPH_DATABASE: string;
			MEMGRAPH_POOL_SIZE: number;
		};
		memgraph: MemgraphDecorator;
	}
}

export {};
