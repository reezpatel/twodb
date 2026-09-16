import multipart from "@fastify/multipart";
import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { StorageCtx } from "../lib/ctx";
import { registerFileRoutes } from "./files";
import { registerFolderRoutes } from "./folders";
import { registerLocationRoutes } from "./locations";

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

export async function registerRoutes(
	scope: TwodbFastifyInstance,
	ctx: StorageCtx,
): Promise<void> {
	// Multipart is scoped to this plugin — the host app stays untouched.
	// Node-backed locations have a tighter per-file cap (see files routes);
	// the 256 MiB bound here only applies to s3-backed uploads.
	await scope.register(multipart, {
		limits: {
			fileSize: MAX_UPLOAD_BYTES,
			files: 25,
			fields: 10,
		},
	});

	registerLocationRoutes(scope, ctx);
	registerFolderRoutes(scope, ctx);
	registerFileRoutes(scope, ctx);
}
