import type { Kysely } from "kysely";
import type { Database } from "../schema";
import { down as adminDown, up as adminUp } from "./0001_admin";

export type Migration = {
	name: string;
	up: (db: Kysely<Database>) => Promise<void>;
	down: (db: Kysely<Database>) => Promise<void>;
};

// Applied in array order, exactly once each, inside a transaction (tracked
// in schema_migrations). Append-only: never edit a shipped migration.
export const migrations: Migration[] = [
	{ name: "0001_admin", up: adminUp, down: adminDown },
];
