import { sql, type Kysely } from "kysely";

// Adds tags to skill/agent/instruction, makes instructionPath optional for
// hand-written instructions, and introduces the shared llm_tag suggestion list.

export async function up(db: Kysely<unknown>): Promise<void> {
  const textArray = sql`text[]`;

  for (const table of ["skill", "agent", "instruction"]) {
    await db.schema
      .alterTable(table)
      .addColumn("tags", textArray, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
      .execute();
  }

  await db.schema
    .alterTable("instruction")
    .alterColumn("instructionPath", (c) => c.dropNotNull())
    .execute();

  // Uniqueness only applies to rows that actually carry a path; nulls not
  // distinct preserves the old codeDirectoryId-null semantics.
  await db.schema.alterTable("instruction").dropConstraint("instruction_scope_path_unique").execute();
  await sql`
    create unique index instruction_scope_path_unique
    on "instruction" ("organizationId", "codeDirectoryId", "instructionPath") nulls not distinct
    where "instructionPath" is not null`.execute(db);

  await db.schema
    .createTable("llm_tag")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("llm_tag_pkey", ["id"])
    .addUniqueConstraint("llm_tag_org_name_unique", ["organizationId", "name"])
    .execute();

  await db.schema.createIndex("llm_tag_organization_idx").ifNotExists().on("llm_tag").column("organizationId").execute();

  await db.schema
    .alterTable("llm_tag")
    .addForeignKeyConstraint("llm_tag_organizationId_fkey", ["organizationId"], "organization", ["id"], (c) => c.onDelete("cascade"))
    .execute();

  // Seed the shared suggestion list from the tags memories already carry.
  await sql`
    insert into "llm_tag" ("id", "organizationId", "name", "createdAt", "updatedAt")
    select distinct md5(random()::text || clock_timestamp()::text), "organizationId", tag, now(), now()
    from "memory", unnest("tags") as tag
    where tag <> ''
    on conflict do nothing`.execute(db);
}
