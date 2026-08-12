import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { isPluginId, type PluginId } from "@twodb/contracts";

/**
 * The shape every service plugin is authored in. The api host mounts each
 * service under `/api/v1/<id>` automatically — services only ever declare
 * their own route paths.
 */
export interface ServiceDefinition {
	/** Unique dot-namespaced plugin identifier, e.g. "twodb.notes". */
	id: PluginId;
	/** Ids of services that must boot before this one (hard dependencies). */
	dependencies?: PluginId[];
	register: (fastify: FastifyInstance) => void | Promise<void>;
}

export interface ServicePlugin {
	(fastify: FastifyInstance): Promise<void>;
	pluginId: PluginId;
	dependencies: PluginId[];
}

/**
 * Author a service plugin. Returns a plain (encapsulated) fastify plugin
 * carrying its identifier and dependency list, so the host can boot-validate
 * order and mount the prefix — deliberately NOT fp-wrapped, because
 * fastify-plugin skips the encapsulation context that route prefixes live
 * in (an fp plugin registered with `{ prefix }` mounts at the root).
 *
 * The shared context (bus, config, db, user, services registry) is decorated
 * on the root instance by core plugins, so this child scope inherits all of
 * it. A service's own decorations stay scoped to itself; cross-service
 * capabilities go through `fastify.services.expose/use` (see registry.ts).
 */
export function defineService(def: ServiceDefinition): ServicePlugin {
	if (!isPluginId(def.id)) {
		throw new Error(
			`defineService: invalid plugin id "${def.id}" — expected lowercase alphanumeric segments joined by dots (e.g. "twodb.notes")`,
		);
	}

	const plugin = async (fastify: FastifyInstance) => {
		await def.register(fastify);
	};

	plugin.pluginId = def.id;
	plugin.dependencies = def.dependencies ?? [];
	return plugin;
}
