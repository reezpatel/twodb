/**
 * Content tree + node API — mirrors plugins/content/service/routes/tree.
 * All `:id` path params accept either a node id or a section identifier
 * (the service resolves them, see service/lib/resolve-node.ts).
 */
import type { ContentNodeDto, ContentViewDto } from "@twodb/contracts";
import type {
	MoveNodeBody,
	PatchNodeBody,
	PostNodeBody,
} from "../../shared/types";
import { apiClient } from "../utils";

export interface DeleteNodeOptions {
	/** When true, the node and its descendants are hard-deleted. */
	hard?: boolean;
}

export const treeApi = {
	getTree: () => apiClient.get<{ nodes: ContentNodeDto[] }>("/tree"),

	createNode: (body: PostNodeBody) =>
		apiClient.post<{ node: ContentNodeDto; view: ContentViewDto | null }>(
			"/nodes",
			body,
		),

	getNode: (id: string) =>
		apiClient.get<{ node: ContentNodeDto; views: ContentViewDto[] }>(
			`/nodes/${id}`,
		),

	patchNode: (id: string, body: PatchNodeBody) =>
		apiClient.patch<{ node: ContentNodeDto }>(`/nodes/${id}`, body),

	moveNode: (id: string, body: MoveNodeBody) =>
		apiClient.post<{ node: ContentNodeDto }>(`/nodes/${id}/move`, body),

	deleteNode: (id: string, opts: DeleteNodeOptions = {}) =>
		apiClient.del(`/nodes/${id}${opts.hard ? "?hard=true" : ""}`),
};
