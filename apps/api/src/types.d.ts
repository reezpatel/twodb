import type { PluginManifest } from "@twodb/contracts";

interface MemgraphDecorator {
	ping: () => Promise<unknown>;
}

declare module "fastify" {
	interface FastifyInstance {
		config: {
			PORT: number;
			STATIC_DIR: string;
			DATABASE_URL: string;
			POSTGRES_POOL_SIZE: number;
			MEMGRAPH_URL: string;
			MEMGRAPH_USER: string;
			MEMGRAPH_PASSWORD: string;
			MEMGRAPH_DATABASE: string;
			MEMGRAPH_POOL_SIZE: number;
			S3_ENDPOINT: string;
			S3_REGION: string;
			S3_BUCKET: string;
			S3_ACCESS_KEY_ID: string;
			S3_SECRET_ACCESS_KEY: string;
			S3_FORCE_PATH_STYLE: boolean;
			TWODB_IDENTIFIER: "email" | "phone" | "email+phone";
			TWODB_SUPERADMIN_EMAIL: string;
			TWODB_REQUIRE_VERIFIED: boolean;
			TWODB_API_ORIGIN: string;
		};
		memgraph: MemgraphDecorator;
		installedPluginManifests: readonly PluginManifest[];
	}
}
