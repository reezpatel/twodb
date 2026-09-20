import type { Kysely } from "kysely";

// biome-ignore lint/suspicious/noEmptyInterface: declaration-merged by plugins via `declare module`
export interface TwodbFn {}

export interface TwodbContext {
  db: Kysely<unknown>;
  fn: TwodbFn;
  pluginId?: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: declaration-merged by plugins via `declare module`
export interface TwodbDatabase {}
