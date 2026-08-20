import type {
	ContentAttachment,
	ContentColumnConfig,
	ContentLink,
	ContentNodeType,
	ContentTag,
	ContentViewConfig,
	ContentViewType,
} from "@twodb/contracts";
import type { Generated } from "kysely";

export interface ContentNodesTable {
	id: string;
	workspace_id: string;
	parent_id: string | null;
	type: ContentNodeType;
	name: string;
	identifier: string;
	position: number;
	deleted: Generated<boolean>;
	show_in_overview: Generated<boolean>;
	columns_config: Generated<ContentColumnConfig[]>;
	default_view: string | null;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface ContentViewsTable {
	id: string;
	section_id: string;
	workspace_id: string;
	name: string;
	type: ContentViewType;
	config: Generated<ContentViewConfig>;
	is_default: Generated<boolean>;
	position: number;
	deleted: Generated<boolean>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface ContentNotesTable {
	id: string;
	workspace_id: string;
	section_id: string;
	title: Generated<string>;
	content: Generated<string>;
	completed: Generated<boolean>;
	deleted: Generated<boolean>;
	position: Generated<number>;
	tags: Generated<ContentTag[]>;
	links: Generated<ContentLink[]>;
	attachments: Generated<ContentAttachment[]>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface ContentDB {
	content_nodes: ContentNodesTable;
	content_views: ContentViewsTable;
	content_notes: ContentNotesTable;
}
