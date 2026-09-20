import type { Kysely } from "kysely";
import type { TwodbContext } from "@twodb/shared-backend";
import type { LlmDb } from "../db";

export type RouteDeps = { ctx: TwodbContext; kysely: Kysely<LlmDb> };
