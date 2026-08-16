import { isClaim, type Claim } from "./claims";
import type { ReactElement, ReactNode } from "react";
import type { IPlugin } from "react-pluggable";
import type { FastifyPluginAsync, FastifyInstance as FastifyInstanceBase } from "fastify";
import type { Kysely } from "kysely";

export interface TwodbFastifyInstance extends FastifyInstanceBase {
  db: Kysely<unknown>;
}

export type TwodbFastifyPluginAsync = (
  instance: TwodbFastifyInstance,
  opts: unknown,
) => Promise<void>;

export interface ViewPluginManifest {
  id: string;
  name: string;
  version: string;

  permissions: { permission: Claim; description: string }[];
  roleDefaults?: Partial<Record<string, Claim[]>>;

  emits: string[];
  consumes: string[];

  provider?: React.FC<{ children: ReactNode }>;

  plugin: IPlugin;

  priority?: number;
}

export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export function isPluginId(value: string) {
  return PLUGIN_ID_PATTERN.test(value);
}

export function validateManifest(manifest: ViewPluginManifest): string[] {
  const problems: string[] = [];
  if (!isPluginId(manifest.id)) {
    problems.push(`id "${manifest.id}" is not a valid plugin identifier`);
  }

  const declared = new Set<string>(
    manifest.permissions.map((items) => items.permission),
  );
  for (const claim of manifest.permissions) {
    if (!isClaim(claim.permission)) {
      problems.push(`permission "${claim}" is not a valid claim`);
    }
  }

  for (const [role, claims] of Object.entries(manifest.roleDefaults ?? {})) {
    if (claims) {
      for (const claim of claims) {
        if (!declared.has(claim)) {
          problems.push(
            `roleDefaults.${role} references undeclared claim "${claim}"`,
          );
        }
      }
    }
  }

  return problems;
}

export interface ServicePluginManifest {
  id: string;
  name: string;
  version: string;

  plugin: TwodbFastifyPluginAsync;
}
