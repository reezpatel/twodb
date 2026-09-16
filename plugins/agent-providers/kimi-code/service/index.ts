import { rootServicePlugin } from "@twodb/shared-backend";
import { InmemoryStore, PlainTextCypher } from "@twodb/shared-backend";
import { kimiCodeManifest } from "../shared/manifest";
import {
	KimiCodeProvider,
	type KimiCodeCredentials,
	type KimiCodeData,
} from "./kimi-code-provider";

export const TwodbKimiCodeServiceManifest = {
	...kimiCodeManifest,

	plugin: rootServicePlugin(
		"twodb-agent-provider-kimi-code-service",
		async (fastify) => {
			const factory = async (creds: {
				apiKey?: string;
				fields: Record<string, string>;
				config: Record<string, string>;
			}) => {
				const credentialStore = new InmemoryStore<KimiCodeCredentials, string>(
					new PlainTextCypher<string>(),
				);
				await credentialStore.init();
				if (creds.apiKey) {
					await credentialStore.save("agent", "api_key", creds.apiKey);
				}
				const dataStore = new InmemoryStore<KimiCodeData, string>(
					new PlainTextCypher<string>(),
				);
				await dataStore.init();
				return new KimiCodeProvider("agent", credentialStore, dataStore);
			};
			fastify.agentProviderRegistry?.register("kimi-code", factory);
			fastify.agentProviderRegistry?.register("kimi", factory);
		},
	),
};

export const service = TwodbKimiCodeServiceManifest;

export default TwodbKimiCodeServiceManifest;

export { KimiCodeProvider } from "./kimi-code-provider";
export type {
	KimiCodeCredentials,
	KimiCodeData,
} from "./kimi-code-provider";
