import type { Migration } from "kysely/migration";
import { up as initial } from "./0001-initial.js";
import { up as backfillLegacyColumns } from "./0002-backfill-legacy-columns.js";
import { up as appToken } from "./0003-app-token.js";
import { up as platformTables } from "./0004-platform-tables.js";
import { up as oauthCode } from "./0005-oauth-code.js";
import { up as appCli } from "./0006-app-cli.js";
import { up as cliCode } from "./0007-cli-code.js";
import { up as notifications } from "./0008-notifications.js";

// Keys sort lexicographically — prefix new migrations with the next number.
export const migrations: Record<string, Migration> = {
  "0001_initial": { up: initial },
  "0002_backfill_legacy_columns": { up: backfillLegacyColumns },
  "0003_app_token": { up: appToken },
  "0004_platform_tables": { up: platformTables },
  "0005_oauth_code": { up: oauthCode },
  "0006_app_cli": { up: appCli },
  "0007_cli_code": { up: cliCode },
  "0008_notifications": { up: notifications },
};
