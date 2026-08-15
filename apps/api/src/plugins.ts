import type { ServicePlugin } from "@twodb/shared-backend";
import type { PluginManifest } from "@twodb/contracts";
import identityService from "@twodb/plugin-identity/service";
import identityManifest from "@twodb/plugin-identity/manifest";
import notesService from "@twodb/plugin-notes/service";
import notesManifest from "@twodb/plugin-notes/manifest";

export const servicePlugins: ServicePlugin[] = [identityService, notesService];

export const manifests: readonly PluginManifest[] = [
	identityManifest,
	notesManifest,
];
