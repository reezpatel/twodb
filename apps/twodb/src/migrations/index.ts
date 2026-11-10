import type { Migration } from "kysely/migration";
import { up as initial } from "./0001-initial.js";
import { up as backfillLegacyColumns } from "./0002-backfill-legacy-columns.js";

// Keys sort lexicographically — prefix new migrations with the next number.
export const migrations: Record<string, Migration> = {
  "0001_initial": { up: initial },
  "0002_backfill_legacy_columns": { up: backfillLegacyColumns },
};
