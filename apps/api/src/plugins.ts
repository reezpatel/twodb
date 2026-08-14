import type { ServicePlugin } from "@twodb/shared-backend";
import identityService from "@twodb/plugin-identity/service";
import notesService from "@twodb/plugin-notes/service";

/**
 * The service registry — every plugin's fastify half, in boot order.
 * The host mounts each under /api/v1/<plugin_id> and validates declared
 * dependencies against this order at boot.
 */
export const servicePlugins: ServicePlugin[] = [identityService, notesService];
