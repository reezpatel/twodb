import type { TwodbContext } from "./context";

type HttpMethod = "get" | "post" | "put" | "delete";

export type RouteHandler = (ctx: TwodbContext, req: Request) => Promise<void>;

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
  init?: (ctx: TwodbContext) => Promise<void>;
  backup?: (ctx: TwodbContext) => Promise<BackupResult>;
  restore?: (ctx: TwodbContext, data: unknown) => Promise<RestoreResult>;

  routes?: Record<string, Partial<Record<HttpMethod, RouteHandler>>>;

  migrations?: Record<
    string,
    {
      up: (db: TwodbContext["db"]) => Promise<void>;
      down: (db: TwodbContext["db"]) => Promise<void>;
    }
  >;
};
