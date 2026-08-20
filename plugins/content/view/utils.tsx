import { ApiClient, ApiError } from "@twodb/shared-frontend";
import { PLUGIN_ID } from "../shared/constants";
import { List, SquareChartGantt, SquareKanban, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import type { NotesViewMode } from "./notes-old/types";

export const apiClient = new ApiClient(PLUGIN_ID);

/** Query key prefix for every content query. */
export const CONTENT_QK = "io.twodb.content";

/**
 * Content queries can fire before the identity provider has persisted the
 * active workspace (first mount) — those 403. Retry a few times so the
 * query self-heals once `x-workspace-id` starts going out.
 */
export const contentQueryRetry = {
  retry: (count: number, error: unknown) =>
    error instanceof ApiError && error.status === 403 && count < 5,
  retryDelay: 400,
} as const;

export const VIEW_OPTIONS = [
  { id: "list", label: "List", icon: <List size={14} /> },
  { id: "table", label: "Table", icon: <Table2 size={14} /> },
  { id: "kanban", label: "Kanban", icon: <SquareKanban size={14} /> },
  { id: "project", label: "Project", icon: <SquareChartGantt size={14} /> },
] satisfies { id: NotesViewMode; label: string; icon: ReactNode }[];
