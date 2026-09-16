import type { Kysely } from "kysely";
import type { StorageDB } from "../db/schema";
import type { SecretBox } from "./crypto";

export type S3Defaults = {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	forcePathStyle: boolean;
};

export interface StorageCtx {
	db: Kysely<StorageDB>;
	secrets: SecretBox;
	emit: (event: string, payload: Record<string, unknown>) => void;
	/** env-level S3 fallbacks (MinIO in dev) when a location has no own creds */
	s3Defaults: S3Defaults;
}
