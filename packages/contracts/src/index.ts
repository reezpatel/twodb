/**
 * @twodb/contracts — the single source of truth for every cross-boundary
 * message in twodb. Pure types plus tiny runtime helpers — no runtime
 * dependencies, so both halves of every plugin (and both hosts) can import
 * it freely without bundle contamination.
 */

export * from "./claims";
export * from "./identity";
export * from "./plugin";

// TODO: Need to review if we need this
export {
  DEFAULT_ROLE_KEYS,
  ROLE_DEFAULT_KEYS,
  isDefaultRoleKey,
  type DefaultRoleKey,
  type RoleDefaultKey,
} from "./roles";

// TODO: Need to review if we need this
export type { EventsFor, MergeEventMaps } from "./events";

// export function apiPrefix(id: PluginId): string {
//   return `/api/v1/${id}`;
// }

// export function viewPrefix(id: PluginId): string {
//   return `/${id}`;
// }
