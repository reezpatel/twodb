import type { TwodbDatabase } from "@twodb/shared-backend/context.js";
import type { FastifyInstance } from "fastify";
import type { Selectable } from "kysely";

// FastifyInstance already carries `config`, `adminDb`, etc. via the module
// augmentation in src/types.d.ts; this alias just keeps admin signatures short.
export type App = FastifyInstance;

export type AdminPasskeyRow = Selectable<TwodbDatabase["admin_passkeys"]>;
export type PluginRow = Selectable<TwodbDatabase["admin_plugins"]>;
export type PluginTemplateRow = Selectable<TwodbDatabase["admin_plugin_templates"]>;
