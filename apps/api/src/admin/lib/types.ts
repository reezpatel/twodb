import type { FastifyInstance } from "fastify";
import type { Selectable } from "kysely";
import type { Database } from "../../db/schema";

// FastifyInstance already carries `config`, `sqlite`, etc. via the module
// augmentation in src/types.d.ts; this alias just keeps admin signatures short.
export type App = FastifyInstance;

export type AdminPasskeyRow = Selectable<Database["admin_passkeys"]>;
export type PluginRow = Selectable<Database["plugins"]>;
export type PluginTemplateRow = Selectable<Database["plugin_templates"]>;
