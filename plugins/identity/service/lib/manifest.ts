import fastifyPlugin from "fastify-plugin";
import type { TwodbFastifyPluginAsync } from "@twodb/contracts";

export const identityManifest = {
	id: "twodb.identity",
	name: "@twodb/identity",
	version: "1.0.0",
	plugin: fastifyPlugin(async () => {}) as TwodbFastifyPluginAsync,
};

export const TwodbIdentityServiceManifest = identityManifest;
