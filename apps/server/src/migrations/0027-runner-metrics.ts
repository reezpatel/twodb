import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * runner_metric — one persisted sample per runner per 10-minute window (the
 * runner streams every 10s; the server keeps the latest-in-window). Gpu/disk
 * arrays stored as jsonb; 30-day retention is enforced on write.
 */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("runner_metric")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("runnerId", "text", (col) => col.notNull())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("at", "timestamptz", (col) => col.notNull())
    .addColumn("cpu", "jsonb", (col) => col.notNull())
    .addColumn("memory", "jsonb", (col) => col.notNull())
    .addColumn("gpus", "jsonb", (col) => col.notNull())
    .addColumn("disks", "jsonb", (col) => col.notNull())
    .execute();

  await db.schema.createIndex("idx_runner_metric_runner_at").on("runner_metric").columns(["runnerId", "at"]).execute();

  // Per-runner disk-path config for metrics (Settings → Runners UI).
  await db.schema.alterTable("runner").addColumn("diskPaths", "jsonb").execute();
};
