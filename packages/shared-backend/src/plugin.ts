import type { FastifyInstance } from "fastify";
import type { TwodbContext, TwodbFn } from "./context";
import type { Migration } from "kysely/migration";

declare module "fastify" {
  interface FastifyInstance {
    invoke<F extends keyof TwodbFn>(name: F, ...args: Parameters<TwodbFn[F]>): ReturnType<TwodbFn[F]>;
    invoke(name: string, ...args: unknown[]): unknown;
  }
}

export type BackupResult = {
  data: unknown;
  success: boolean;
  errors: string[];
};

export type RestoreResult = {
  success: boolean;
  errors: string[];
};

export type ServicePluginFunction = (...args: never[]) => unknown;

export type ServicePlugin = {
  // runs on the host root before any route is mounted — for cross-cutting
  // request decorations (userId, workspaceId, …) all plugins can rely on
  setup?: (ctx: TwodbContext, app: FastifyInstance) => Promise<void>;
  init?: (ctx: TwodbContext, app: FastifyInstance) => Promise<void>;
  backup?: (ctx: TwodbContext) => Promise<BackupResult>;
  restore?: (ctx: TwodbContext, data: unknown) => Promise<RestoreResult>;

  // cross-plugin RPC — keys and signatures are typed by augmenting TwodbFn
  // (declare module "@twodb/shared-backend"), resolved at boot via app.invoke
  functions?: Record<string, ServicePluginFunction> & Partial<TwodbFn>;

  migrations?: Record<string, Migration>;
};
