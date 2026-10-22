import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** runner.awsStartUrl + awsSsoRegion — the runner's SSO start-app config
 * (Settings → Runners); the AWS widget's login uses it when set. */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("runner").addColumn("awsStartUrl", "text").execute();
  await db.schema.alterTable("runner").addColumn("awsSsoRegion", "text").execute();
};
