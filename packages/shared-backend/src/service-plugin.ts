import fp from "fastify-plugin";
import type {
	TwodbFastifyInstance,
	TwodbFastifyPluginAsync,
} from "@twodb/contracts";

type RoutesFn = (scope: TwodbFastifyInstance) => Promise<void> | void;
type BootFn = (
	root: TwodbFastifyInstance,
) => Promise<RoutesFn | void> | RoutesFn | void;

/**
 * Wraps a service plugin with fastify-plugin: `boot` runs on the ROOT
 * instance, so its decorations (fastify.nodeInvoke, fastify.agents, …) are
 * visible to every sibling service. Whatever `boot` returns is invoked as
 * the route registrar on a prefixed child scope, so the host's
 * /api/v1/<plugin_id> mounting still holds — fp plugins ignore the
 * register-time prefix, which is why routes must be re-scoped explicitly
 * from the opts the host passes in.
 */
export function rootServicePlugin(
	name: string,
	boot: BootFn,
): TwodbFastifyPluginAsync {
	return fp(
		async (fastify: TwodbFastifyInstance, opts: unknown) => {
			const routes = await boot(fastify);
			if (routes) {
				await fastify.register(async (scope) => routes(scope), {
					prefix: (opts as { prefix?: string }).prefix ?? "",
				});
			}
		},
		{ name },
	) as unknown as TwodbFastifyPluginAsync;
}
