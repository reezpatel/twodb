import _0001_init from "./0001_init";
import type { Migration } from "kysely/migration";

export const migrations: Record<string, Migration> = { "0001_admin": _0001_init };
