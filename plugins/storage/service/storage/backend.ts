import type { StorageLocationKind } from "../../shared/types";

export type PutOptions = { contentType?: string };

export type StoredObject = { data: Buffer; etag: string | null };

/**
 * A physical byte store behind a storage location. Keys are opaque
 * `<root_folder_id>/<file_id>` strings — metadata (names, tree shape) lives
 * in the plugin's own tables, so renames never touch the backend.
 */
export interface StorageBackend {
	readonly kind: StorageLocationKind;
	put(
		key: string,
		data: Buffer,
		options?: PutOptions,
	): Promise<{ etag: string | null }>;
	get(key: string): Promise<StoredObject>;
	delete(key: string): Promise<void>;
	/** move an object within the same location */
	move(fromKey: string, toKey: string): Promise<void>;
	/** remove every object under `prefix` — used when a folder tree is deleted */
	deletePrefix(prefix: string): Promise<void>;
	/** batch delete by exact keys (nested-folder subtree deletes) */
	deleteMany(keys: string[]): Promise<void>;
	/** ensure the physical dir for a root folder exists (no-op on s3) */
	ensureDir(key: string): Promise<void>;
	/**
	 * Direct browser-accessible URL (presigned GET); null when the api must
	 * stream the bytes itself (node-backed locations).
	 */
	accessUrl(
		key: string,
		options: { filename: string; expiresInSec: number },
	): Promise<string | null>;
	/** probe the backend; throws with a reason when unreachable */
	health(): Promise<void>;
}
