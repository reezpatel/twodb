export const PLUGIN_ID = "io.twodb.content";

export const NODE_TYPES = ["folder", "section"] as const;
export const VIEW_TYPES = ["list", "table", "kanban", "project"] as const;
export const COLUMN_TYPES = [
	"text",
	"number",
	"checkbox",
	"date",
	"url",
	"select",
	"multi_select",
	"relation",
	"person",
] as const;

/** Core note fields exposed as mandatory pseudo-columns in the schema DTO. */
export const CORE_COLUMNS = [
	{ column_id: "title", name: "Title", type: "text" },
	{ column_id: "content", name: "Content", type: "text" },
	{ column_id: "completed", name: "Completed", type: "checkbox" },
	{ column_id: "tags", name: "Tags", type: "multi_select" },
	{ column_id: "created_at", name: "Created", type: "date" },
	{ column_id: "updated_at", name: "Updated", type: "date" },
] as const;