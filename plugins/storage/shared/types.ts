export type StorageLocationKind = "node" | "s3";

export type S3Credentials = {
	access_key_id: string;
	secret_access_key: string;
	session_token?: string;
};

export type LocationNodeConfig = {
	node_id: string;
	/** directory inside the node's sandboxed root that backs this location */
	root_path: string;
};

export type LocationS3Config = {
	bucket: string;
	region: string;
	/** null → real AWS endpoints */
	endpoint: string | null;
	prefix: string;
	force_path_style: boolean;
	/** true when credentials come from the encrypted blob (not env fallback) */
	has_credentials: boolean;
};

export type LocationDto = {
	id: string;
	workspace_id: string;
	name: string;
	kind: StorageLocationKind;
	node: LocationNodeConfig | null;
	s3: LocationS3Config | null;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type FolderDto = {
	id: string;
	workspace_id: string;
	parent_id: string | null;
	/** the root folder of this folder's tree (self for roots) */
	root_id: string;
	/** set on root folders only — where the tree physically lives */
	location_id: string | null;
	name: string;
	created_by: string;
	created_at: string;
	updated_at: string;
};

/** Root folder with aggregate stats for the folder cards. */
export type FolderSummaryDto = FolderDto & {
	file_count: number;
	total_size: number;
};

export type FileKind = "document" | "spreadsheet" | "pdf" | "image" | "other";

export type FileDto = {
	id: string;
	workspace_id: string;
	folder_id: string;
	root_id: string;
	name: string;
	/** bytes */
	size: number;
	mime_type: string;
	kind: FileKind;
	etag: string | null;
	last_opened_at: string | null;
	uploaded_by: string;
	created_at: string;
	updated_at: string;
};

export type BreadcrumbEntry = { id: string; name: string };
