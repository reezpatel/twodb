import type { Migration } from "kysely/migration";
import { up as initial } from "./0001-initial";

// Keys sort lexicographically — prefix new migrations with the next number.
export const migrations: Record<string, Migration> = {
  "0001_initial": { up: initial },
};
