import type { Migration } from "kysely/migration";
import { coreTenancyMigration } from "./001-core-tenancy";
import { authMethodsMigration } from "./002-auth-methods";
import { rolesAndGrantsMigration } from "./003-roles-and-grants";
import { roleKeyDescriptionMigration } from "./004-role-key-description";
import { assignmentIdMigration } from "./005-assignment-id";
import { appsMigration } from "./008-apps";
import { auditAndDeploymentMigration } from "./009-audit-and-deployment";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-core-tenancy": coreTenancyMigration,
		"002-auth-methods": authMethodsMigration,
		"003-roles-and-grants": rolesAndGrantsMigration,
		"004-role-key-description": roleKeyDescriptionMigration,
		"005-assignment-id": assignmentIdMigration,
		"008-apps": appsMigration,
		"009-audit-and-deployment": auditAndDeploymentMigration,
	};
}
