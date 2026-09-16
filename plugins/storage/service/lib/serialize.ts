import type { Selectable } from "kysely";
import type {
	StorageFilesTable,
	StorageFoldersTable,
	StorageLocationsTable,
} from "../db/schema";
import type {
	FileDto,
	FolderDto,
	FolderSummaryDto,
	LocationDto,
} from "../../shared/types";
import { mimeKind } from "./paths";

export type LocationRow = Selectable<StorageLocationsTable>;
export type FolderRow = Selectable<StorageFoldersTable>;
export type FileRow = Selectable<StorageFilesTable>;

export function toLocationDto(row: LocationRow): LocationDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		name: row.name,
		kind: row.kind,
		node:
			row.kind === "node"
				? { node_id: row.node_id!, root_path: row.root_path }
				: null,
		s3:
			row.kind === "s3"
				? {
						bucket: row.bucket!,
						region: row.region ?? "us-east-1",
						endpoint: row.endpoint,
						prefix: row.prefix,
						force_path_style: row.force_path_style,
						has_credentials: row.credentials_encrypted !== null,
					}
				: null,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toFolderDto(row: FolderRow): FolderDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		parent_id: row.parent_id,
		root_id: row.root_id,
		location_id: row.location_id,
		name: row.name,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toFolderSummaryDto(
	row: FolderRow,
	fileCount: string | number,
	totalSize: string | number,
): FolderSummaryDto {
	return {
		...toFolderDto(row),
		file_count: Number(fileCount),
		total_size: Number(totalSize),
	};
}

export function toFileDto(row: FileRow): FileDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		folder_id: row.folder_id,
		root_id: row.root_id,
		name: row.name,
		size: row.size,
		mime_type: row.mime_type,
		kind: mimeKind(row.mime_type),
		etag: row.etag,
		last_opened_at: row.last_opened_at?.toISOString() ?? null,
		uploaded_by: row.uploaded_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}
