import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** Projects app — Linear-like tracking. Projects are config containers (no
 * tickets directly); tickets always live in a subproject. Identifiers are
 * per-project: `${project.key}-${project.nextTicketNumber}`. See
 * scratch_pad/PLAN-projects.md for the full model. */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("project")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("spaceId", "text")
    .addColumn("name", "text", (c) => c.notNull())
    // Uppercase short key for identifiers ("PRO"). Unique per org.
    .addColumn("key", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("icon", "text")
    .addColumn("color", "text")
    // Atomic per-project ticket sequence; identifiers are `${key}-${n-1}`.
    .addColumn("nextTicketNumber", "integer", (c) => c.notNull().defaultTo(1))
    // External sync: set when created by linking Linear/Plane; config rows
    // (statuses, labels) copied from the remote become read-only.
    .addColumn("externalSource", "text") // 'linear' | 'plane' | null
    .addColumn("externalRef", "jsonb") // remote ids (teamId/projectId, workspace, baseUrl, filter)
    .addColumn("syncFilter", "jsonb")
    .addColumn("lastSyncAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("project_external_source_check", sql`"externalSource" IS NULL OR "externalSource" IN ('linear', 'plane')`)
    .execute();
  await db.schema.createIndex("project_org_idx").on("project").columns(["organizationId"]).execute();
  await db.schema.createIndex("project_org_key_uq").on("project").columns(["organizationId", "key"]).unique().execute();

  await db.schema
    .createTable("project_member")
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull().defaultTo("member")) // owner | admin | member
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("project_member_pkey", ["projectId", "userId"])
    .addCheckConstraint("project_member_role_check", sql`role IN ('owner', 'admin', 'member')`)
    .execute();
  await db.schema.createIndex("project_member_user_idx").on("project_member").columns(["userId"]).execute();

  await db.schema
    .createTable("subproject")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("subproject_project_idx").on("subproject").columns(["projectId"]).execute();

  // Status columns. Project-scoped, optionally overridden per subproject
  // (subprojectId set). Synced projects lock them (editable='sync').
  await db.schema
    .createTable("project_status")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("subprojectId", "text") // null = project-level set
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text", (c) => c.notNull().defaultTo("#888888"))
    .addColumn("category", "text", (c) => c.notNull()) // backlog | todo | in_progress | done | canceled
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("editable", "text", (c) => c.notNull().defaultTo("yes")) // yes | sync (locked)
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("project_status_category_check", sql`category IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')`)
    .addCheckConstraint("project_status_editable_check", sql`editable IN ('yes', 'sync')`)
    .execute();
  await db.schema.createIndex("project_status_project_idx").on("project_status").columns(["projectId", "subprojectId", "position"]).execute();

  await db.schema
    .createTable("label_group")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createTable("label")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("groupId", "text", (c) => c.references("label_group.id").onDelete("set null"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text", (c) => c.notNull().defaultTo("#888888"))
    .addColumn("editable", "text", (c) => c.notNull().defaultTo("yes")) // yes | sync
    .addColumn("externalRef", "jsonb")
    .addCheckConstraint("label_editable_check", sql`editable IN ('yes', 'sync')`)
    .execute();
  await db.schema.createIndex("label_project_idx").on("label").columns(["projectId"]).execute();

  await db.schema
    .createTable("project_tag")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text", (c) => c.notNull().defaultTo("#888888"))
    .execute();
  await db.schema.createIndex("project_tag_project_idx").on("project_tag").columns(["projectId"]).execute();

  // Project-level milestones and sprints — tickets from any subproject attach.
  await db.schema
    .createTable("milestone")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("targetDate", "date")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("open")) // open | closed
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("milestone_status_check", sql`status IN ('open', 'closed')`)
    .execute();
  await db.schema.createIndex("milestone_project_idx").on("milestone").columns(["projectId", "position"]).execute();

  await db.schema
    .createTable("sprint")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("startDate", "date")
    .addColumn("endDate", "date")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("planned")) // planned | active | closed
    // Velocity snapshot at close: sum of estimates that were done at close.
    .addColumn("completedPoints", "double precision")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("sprint_status_check", sql`status IN ('planned', 'active', 'closed')`)
    .execute();
  await db.schema.createIndex("sprint_project_idx").on("sprint").columns(["projectId", "status"]).execute();

  await db.schema
    .createTable("project_link")
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("linkedProjectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("project_link_pkey", ["projectId", "linkedProjectId"])
    .addCheckConstraint("project_link_not_self", sql`"projectId" <> "linkedProjectId"`)
    .execute();

  await db.schema
    .createTable("ticket")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("projectId", "text", (c) => c.notNull().references("project.id").onDelete("cascade"))
    .addColumn("subprojectId", "text", (c) => c.notNull().references("subproject.id").onDelete("cascade"))
    .addColumn("number", "integer", (c) => c.notNull()) // per project; identifier = project.key-number
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("type", "text", (c) => c.notNull().defaultTo("issue")) // issue | epic | bug | task | feature | chore
    .addColumn("statusId", "text", (c) => c.notNull().references("project_status.id"))
    .addColumn("priority", "text", (c) => c.notNull().defaultTo("none")) // none | low | medium | high | urgent
    .addColumn("estimate", "double precision")
    .addColumn("parentTicketId", "text") // subtasks, one level deep (app-enforced)
    .addColumn("epicId", "text") // ticket of type=epic this belongs to
    .addColumn("sprintId", "text", (c) => c.references("sprint.id").onDelete("set null"))
    .addColumn("milestoneId", "text", (c) => c.references("milestone.id").onDelete("set null"))
    .addColumn("assigneeUserId", "text", (c) => c.references("user.id").onDelete("set null"))
    // Backlog bucket: explicit, regardless of status category.
    .addColumn("inBacklog", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    // External sync identity + drift detection.
    .addColumn("externalRef", "jsonb") // { source, externalId, externalUrl, syncedHash, remoteUpdatedAt }
    .addColumn("deletedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("ticket_type_check", sql`type IN ('issue', 'epic', 'bug', 'task', 'feature', 'chore')`)
    .addCheckConstraint("ticket_priority_check", sql`priority IN ('none', 'low', 'medium', 'high', 'urgent')`)
    .execute();
  await db.schema.createIndex("ticket_project_number_uq").on("ticket").columns(["projectId", "number"]).unique().execute();
  await sql`CREATE INDEX ticket_subproject_idx ON ticket ("subprojectId", "statusId", "position") WHERE "deletedAt" IS NULL`.execute(db);
  await sql`CREATE INDEX ticket_parent_idx ON ticket ("parentTicketId") WHERE "parentTicketId" IS NOT NULL`.execute(db);
  await sql`CREATE INDEX ticket_epic_idx ON ticket ("epicId") WHERE "epicId" IS NOT NULL`.execute(db);
  await sql`CREATE INDEX ticket_sprint_idx ON ticket ("sprintId") WHERE "sprintId" IS NOT NULL`.execute(db);

  await db.schema
    .createTable("ticket_dependency")
    .addColumn("ticketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    // ticket is blocked by dependsOnTicketId. Same project only; cycles rejected by the app.
    .addColumn("dependsOnTicketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("ticket_dependency_pkey", ["ticketId", "dependsOnTicketId"])
    .addCheckConstraint("ticket_dependency_not_self", sql`"ticketId" <> "dependsOnTicketId"`)
    .execute();
  await db.schema.createIndex("ticket_dependency_blocks_idx").on("ticket_dependency").columns(["dependsOnTicketId"]).execute();

  await db.schema
    .createTable("ticket_label")
    .addColumn("ticketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    .addColumn("labelId", "text", (c) => c.notNull().references("label.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("ticket_label_pkey", ["ticketId", "labelId"])
    .execute();

  await db.schema
    .createTable("ticket_tag")
    .addColumn("ticketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    .addColumn("tagId", "text", (c) => c.notNull().references("project_tag.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("ticket_tag_pkey", ["ticketId", "tagId"])
    .execute();

  await db.schema
    .createTable("ticket_comment")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("ticketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("ticket_comment_ticket_idx").on("ticket_comment").columns(["ticketId", "createdAt"]).execute();

  // Checklist items on a ticket; parentItemId nests them.
  await db.schema
    .createTable("ticket_checklist_item")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("ticketId", "text", (c) => c.notNull().references("ticket.id").onDelete("cascade"))
    .addColumn("parentItemId", "text")
    .addColumn("text", "text", (c) => c.notNull())
    .addColumn("done", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("ticket_checklist_ticket_idx").on("ticket_checklist_item").columns(["ticketId", "position"]).execute();
};
