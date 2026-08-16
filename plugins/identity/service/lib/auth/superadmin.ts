import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { IdentityDB } from "../../db/schema";

export async function maybeSeedSuperadmin(
	db: Kysely<IdentityDB>,
	fastify: FastifyInstance,
	emailRaw: string | undefined,
): Promise<void> {
	const email = emailRaw?.trim().toLowerCase();
	if (!email) return;
	const existing = await db
		.selectFrom("platform_admins")
		.select("user_id")
		.executeTakeFirst();
	if (existing) return;
	const user = await db
		.selectFrom("users")
		.select("id")
		.where((eb) =>
			eb.or([eb("identifier", "=", email), eb("email", "=", email)]),
		)
		.executeTakeFirst();
	if (!user) return;
	await db
		.insertInto("platform_admins")
		.values({ user_id: user.id, granted_by: null })
		.execute();
	fastify.log.info(`twodb.identity: ${email} is now superadmin`);
}
