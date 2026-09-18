import type { Kysely } from "kysely";

export type TwodbFn = {};

export interface TwodbContext {
  db: Kysely<unknown>;
  fn: TwodbFn;
}

export interface TwodbDatabase {}
