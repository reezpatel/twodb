import type { Kysely } from "kysely";
import type { ContentDB } from "../db/schema";
import type { ContentNode } from "./tree";

/**
 * Plan §5: every :id path param accepts either the node id (`nod-…`) or the
 * section identifier (slug). Resolves within the workspace, live sections
 * only for section routes.
 */
export async function resolveNode(
	db: Kysely<ContentDB>,
	workspaceId: string,
	idOrIdentifier: string,
	options: { sectionsOnly?: boolean; includeDeleted?: boolean } = {},
): Promise<ContentNode | null> {
	let qb = db
		.selectFrom("content_nodes")
		.selectAll()
		.where("workspace_id", "=", workspaceId)
		.where((eb) =>
			eb.or([
				eb("id", "=", idOrIdentifier),
				eb("identifier", "=", idOrIdentifier.toLowerCase()),
			]),
		);
	if (options.sectionsOnly) qb = qb.where("type", "=", "section");
	if (!options.includeDeleted) qb = qb.where("deleted", "=", false);
	return (await qb.executeTakeFirst()) ?? null;
}
