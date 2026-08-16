import type { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

export async function ownerRoleId(
	db: ReturnType<typeof typedDb<IdentityDB>>,
	workspaceId: string,
): Promise<string | null> {
	const row = await db
		.selectFrom("roles")
		.select("id")
		.where("workspace_id", "=", workspaceId)
		.where("key", "=", "owner")
		.executeTakeFirst();
	return row?.id ?? null;
}

export async function ownerAssignmentCount(
	db: ReturnType<typeof typedDb<IdentityDB>>,
	workspaceId: string,
	ownerId: string,
): Promise<number> {
	const row = await db
		.selectFrom("workspace_role_assignments")
		.select((eb) => eb.fn.count<number>("user_id").as("c"))
		.where("workspace_id", "=", workspaceId)
		.where("role_id", "=", ownerId)
		.executeTakeFirst();
	return Number(row?.c ?? 0);
}
