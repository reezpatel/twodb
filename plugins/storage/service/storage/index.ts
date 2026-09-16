import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { StorageCtx } from "../lib/ctx";
import type { LocationRow } from "../lib/serialize";
import type { StorageBackend } from "./backend";
import { NodeStorageBackend } from "./node-backend";
import { s3BackendFor } from "./s3-backend";

/**
 * Resolve the physical backend for a location row. S3 credentials come from
 * the encrypted blob when present, otherwise from the env-level defaults
 * (local MinIO in dev).
 */
export function backendFor(
	location: LocationRow,
	fastify: TwodbFastifyInstance,
	ctx: StorageCtx,
): StorageBackend {
	if (location.kind === "node") {
		if (!fastify.nodeInvoke) {
			throw new Error("node invoke is not available");
		}
		if (!location.node_id) {
			throw new Error("location has no node bound");
		}
		return new NodeStorageBackend(
			fastify.nodeInvoke,
			location.node_id,
			location.root_path,
		);
	}

	if (!location.bucket) {
		throw new Error("location has no bucket configured");
	}
	const blob = location.credentials_encrypted
		? ctx.secrets.decrypt(location.credentials_encrypted)
		: null;
	const creds = blob
		? {
				accessKeyId: blob.access_key_id ?? "",
				secretAccessKey: blob.secret_access_key ?? "",
				sessionToken: blob.session_token,
			}
		: {
				accessKeyId: ctx.s3Defaults.accessKeyId,
				secretAccessKey: ctx.s3Defaults.secretAccessKey,
			};
	return s3BackendFor({
		bucket: location.bucket,
		region: location.region ?? ctx.s3Defaults.region,
		endpoint: location.endpoint,
		prefix: location.prefix,
		forcePathStyle: location.force_path_style,
		creds,
	});
}
