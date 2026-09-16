import type { PluginManifest } from "@twodb/contracts";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import type { Kysely } from "kysely";
import type { Database } from "./db/schema";
import type { MemgraphDecorator } from "./db/memgraph";

interface SqliteDecorator {
	db: Kysely<Database>;
	raw: BetterSqliteDatabase;
	filePath: string;
	appliedMigrations: string[];
	ping: () => Promise<void>;
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
			TWODB_AGENT_ENCRYPTION_KEY: string;
			TWODB_AGENT_USAGE_INTERVAL_MS: number;
			TWODB_STORAGE_ENCRYPTION_KEY: string;
			TWO_DB_WORK_DIR: string;
			TWODB_ADMIN_RP_ID: string;
			TWODB_ADMIN_ORIGIN: string;
			TWODB_ADMIN_SESSION_TTL_MS: number;
		};
		memgraph: MemgraphDecorator;
		sqlite: SqliteDecorator;
		installedPluginManifests: readonly PluginManifest[];
	}
}
