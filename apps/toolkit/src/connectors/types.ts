/**
 * Connector framework. A ConnectorTemplate is code-owned (see
 * connectors/plane.ts for the first one); users configure instances of a
 * template with its declared fields. Each instance exposes:
 *
 *  - commands: execution tools other apps invoke via the API
 *    (POST /tools/:toolId/invoke → { output }) and see listed on the
 *    instance page;
 *  - broadcasts: optional background activity (a poll run every
 *    pollIntervalMs while enabled) that emits events other apps listen to
 *    via GET /events|/events/stream, or receive durably by requesting a
 *    named queue (GET /queues/:name/next) — broadcasts can be dropped,
 *    queues can't.
 */

export interface ConnectorField {
  key: string;
  label: string;
  /** Secret values are AES-GCM encrypted at rest and never returned by the API. */
  secret?: boolean;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  /** Hint shown under the field (e.g. where to create the API key). */
  help?: string;
  /** "select" fields are filled from a server-side option source (see GET /connector-templates/:id/fields/:key/options). */
  type?: "text" | "select";
}

export interface ConnectorCommand {
  /** Wire name used in tool ids: <template>.<command> */
  name: string;
  description: string;
  /** JSON-schema-ish parameter docs — { key: {type, description, required?} }. */
  params: Record<string, { type: "string" | "number" | "boolean" | "enum" | "date" | "asset" | "assets"; description: string; required?: boolean; options?: string[] }>;
}

export interface BroadcastEventSpec {
  event: string;
  description: string;
}

/** Context handed to template code. */
export interface ConnectorRuntime {
  /** Decrypted config (fieldKey → value). */
  config: Record<string, string>;
  /** Persist a template-defined state blob (returned on the next run). */
  getState<T = unknown>(): Promise<T | null>;
  setState(state: unknown): Promise<void>;
  /** Emit a broadcast event: fans out to listeners AND all requested queues. */
  emit(event: string, payload: unknown): Promise<void>;
  log(message: string): void;
  /** Platform services (absent in unit tests / dev-direct without a control plane). */
  host?: ConnectorHost;
}

/** What a template may ask of the toolkit host. */
export interface ConnectorHost {
  workspaceId: string;
  instanceId: string;
  /** Call another app as toolkit inside this workspace (service token, act-as-workspace). */
  callApp(app: string, path: string, init?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<{ status: number; body: any }>;
  /** Presigned URLs for ANY bucket key (gateway /registry/s3/presign). */
  presign(ops: Array<{ method: "GET" | "PUT"; key: string; expiresIn?: number; contentType?: string }>): Promise<Array<{ key: string; url: string }>>;
  /** Run registry: output prefixes + upload bookkeeping for pipeline runs. */
  runs: import("../runs.js").RunRegistry;
}

export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: ConnectorField[];
  commands: ConnectorCommand[];
  broadcasts: BroadcastEventSpec[];
  /** Poll period while enabled (0/null = no background activity). */
  pollIntervalMs?: number;
  /** Health-check the config (called on save + from the UI). Throw on failure. */
  healthCheck(config: Record<string, string>): Promise<void>;
  /** Options for a `select` field, given the other config values entered so far. */
  fieldOptions?(fieldKey: string, host: ConnectorHost): Promise<Array<{ value: string; label: string }>>;
  /** Per-instance commands (e.g. the pipelines a chosen runner advertises). Replaces `commands` when it resolves. */
  resolveCommands?(config: Record<string, string>, host: ConnectorHost): Promise<ConnectorCommand[]>;
  /** Execute a command. Return any JSON value — that IS the output. */
  execute(command: string, params: Record<string, unknown>, rt: ConnectorRuntime): Promise<unknown>;
  /** One poll tick — diff/emit broadcasts. */
  poll?(rt: ConnectorRuntime): Promise<void>;
}
