import type { FastifyInstance } from "fastify";
import type { TwodbContext } from "./context";
import type { Migration } from "kysely/migration";

export type BackupResult = {
  data: unknown;
  success: boolean;
  errors: string[];
};

export type RestoreResult = {
  success: boolean;
  errors: string[];
};

export type ServicePlugin = {
  init?: (ctx: TwodbContext, app: FastifyInstance) => Promise<void>;
  backup?: (ctx: TwodbContext) => Promise<BackupResult>;
  restore?: (ctx: TwodbContext, data: unknown) => Promise<RestoreResult>;

  migrations?: Record<string, Migration>;
};
