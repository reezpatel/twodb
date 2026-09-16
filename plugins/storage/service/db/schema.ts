import type { Generated } from "kysely";
import type { StorageLocationKind } from "../../shared/types";

export interface StorageLocationsTable {
	id: string;
	workspace_id: string;
	name: string;
	kind: StorageLocationKind;
	node_id: string | null;
	root_path: string;
	bucket: string | null;
	region: string | null;
	endpoint: string | null;
	prefix: string;
	force_path_style: boolean;
	credentials_encrypted: string | null;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface StorageFoldersTable {
	id: string;
	workspace_id: string;
	parent_id: string | null;
	/** denormalized root of the tree (self for root folders) */
	root_id: string;
	/** set on root folders only — the physical storage location */
	location_id: string | null;
	name: string;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface StorageFilesTable {
	id: string;
	workspace_id: string;
	folder_id: string;
	/** denormalized root folder id — keeps aggregates and deletes cheap */
	root_id: string;
	name: string;
	storage_key: string;
	size: number;
	mime_type: string;
	etag: string | null;
	last_opened_at: Date | null;
	uploaded_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface StorageDB {
	storage_locations: StorageLocationsTable;
	storage_folders: StorageFoldersTable;
	storage_files: StorageFilesTable;
}
