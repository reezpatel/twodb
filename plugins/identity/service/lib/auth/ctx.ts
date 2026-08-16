import type { Kysely } from "kysely";
import type { IdentifierMode, IdentityDB } from "../../db/schema";

/** Everything the identity route modules need, handed down from register(). */
export interface AuthCtx {
	db: Kysely<IdentityDB>;
	mode: IdentifierMode;
	requireVerified: boolean;
	apiOrigin: string;
	superadminEmail?: string;
}
