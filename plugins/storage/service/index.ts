import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { storageDb } from "./db";
import { buildMigrations } from "./db/migrations";
import { SecretBox } from "./lib/crypto";
import type { StorageCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { storageManifest } from "../shared/manifest";

export const TwodbStorageServiceManifest = {
	...storageManifest,

	permissions: [
		{
			permission: "plugin.twodb.storage:locations.read",
			description: "List and view storage locations",
		},
		{
			permission: "plugin.twodb.storage:locations.manage",
			description: "Create, edit and delete storage locations",
		},
		{
			permission: "plugin.twodb.storage:folders.read",
			description: "Browse folders",
		},
		{
			permission: "plugin.twodb.storage:folders.manage",
			description: "Create, rename and delete folders",
		},
		{
			permission: "plugin.twodb.storage:files.read",
			description: "List, search and download files",
		},
		{
			permission: "plugin.twodb.storage:files.manage",
			description: "Upload, rename, move and delete files",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.storage:locations.read",
			"plugin.twodb.storage:locations.manage",
			"plugin.twodb.storage:folders.read",
			"plugin.twodb.storage:folders.manage",
			"plugin.twodb.storage:files.read",
			"plugin.twodb.storage:files.manage",
		],
		member: [
			"plugin.twodb.storage:locations.read",
			"plugin.twodb.storage:folders.read",
			"plugin.twodb.storage:folders.manage",
			"plugin.twodb.storage:files.read",
			"plugin.twodb.storage:files.manage",
		],
	},

	plugin: rootServicePlugin("twodb-storage-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const config = (
			fastify as unknown as {
				config: {
					TWODB_STORAGE_ENCRYPTION_KEY: string;
					S3_ENDPOINT: string;
					S3_REGION: string;
					S3_BUCKET: string;
					S3_ACCESS_KEY_ID: string;
					S3_SECRET_ACCESS_KEY: string;
					S3_FORCE_PATH_STYLE: boolean;
				};
			}
		).config;

		const ctx: StorageCtx = {
			db: storageDb(fastify),
			secrets: new SecretBox(config.TWODB_STORAGE_ENCRYPTION_KEY),
			emit: (event, payload) => fastify.bus.emit(event, payload),
			s3Defaults: {
				endpoint: config.S3_ENDPOINT,
				region: config.S3_REGION,
				bucket: config.S3_BUCKET,
				accessKeyId: config.S3_ACCESS_KEY_ID,
				secretAccessKey: config.S3_SECRET_ACCESS_KEY,
				forcePathStyle: config.S3_FORCE_PATH_STYLE,
			},
		};

		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbStorageServiceManifest;

export default TwodbStorageServiceManifest;
