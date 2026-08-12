import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { PluginId } from "@twodb/contracts";

declare module "fastify" {
	interface FastifyInstance {
		/** Cross-service capability registry. */
		services: ServiceRegistry;
	}
}

export interface ServiceRegistry {
	/** Publish a capability under this plugin's id (call from register()). */
	expose<T>(id: PluginId, api: T): void;
	/** Use another service's exposed capability. Throws if absent — declare
	 *  the dependency in `defineService({ dependencies })` so boot order
	 *  guarantees it exists. */
	use<T>(id: PluginId): T;
}

/**
 * Core plugin: the cross-service capability registry. Services are
 * encapsulated scopes (so their route prefixes apply), which isolates their
 * own decorations — this root-decorated registry is the deliberate, typed
 * channel for one service to offer a synchronous API to another. Loose
 * coupling still goes through `fastify.bus`; this is for hard dependencies.
 */
export const serviceRegistryPlugin = fp(
	async (fastify: FastifyInstance) => {
		const exposed = new Map<PluginId, unknown>();
		fastify.decorate("services", {
			expose<T>(id: PluginId, api: T): void {
				exposed.set(id, api);
			},
			use<T>(id: PluginId): T {
				if (!exposed.has(id)) {
					throw new Error(
						`Service "${id}" has not exposed a capability — is it registered, and listed in your dependencies?`,
					);
				}
				return exposed.get(id) as T;
			},
		} satisfies ServiceRegistry);
	},
	{ name: "twodb-service-registry" },
);
