import { type Claim } from "./claims";
import type { ReactNode } from "react";
import type { IPlugin } from "react-pluggable";
import type { FastifyInstance as FastifyInstanceBase } from "fastify";
import type { Kysely } from "kysely";

export interface TwodbFastifyInstance extends FastifyInstanceBase {
  db: Kysely<unknown>;
}

export type TwodbFastifyPluginAsync = (
  instance: TwodbFastifyInstance,
  opts: unknown,
) => Promise<void>;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
}

export interface ViewPluginManifest extends PluginManifest {
  provider?: React.FC<{ children: ReactNode }>;

  plugin: IPlugin;

  priority?: number;
}

export interface ServicePluginManifest extends PluginManifest {
  plugin: TwodbFastifyPluginAsync;

  permissions: { permission: Claim; description: string }[];
  roleDefaults?: Partial<Record<string, Claim[]>>;
}
