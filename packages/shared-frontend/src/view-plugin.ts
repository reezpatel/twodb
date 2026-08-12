import type { IPlugin, PluginStore } from "react-pluggable";
import type { PluginManifest } from "@twodb/contracts";
import { getBus, type FrontendBus } from "./bus";
import { getApi, type PluginApi } from "./api";
import type { ShellContribution } from "./shell";

/**
 * Base class for view plugins. Subclasses provide a `manifest` and implement
 * `activate()`; helpers wire the plugin to the bus, its scoped API handle,
 * and the shell's contribution points — all keyed by the manifest's id.
 */
export abstract class ViewPlugin implements IPlugin {
	pluginStore!: PluginStore;
	abstract readonly manifest: PluginManifest;

	getPluginName(): string {
		return `${this.manifest.id}@${this.manifest.version}`;
	}

	getDependencies(): string[] {
		return [];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	abstract activate(): void;

	deactivate(): void {}

	/** The typed frontend bus (includes mirrored backend events). */
	protected get bus(): FrontendBus {
		return getBus(this.pluginStore);
	}

	/** API handle pre-scoped to this plugin: `/api/v1/<id><path>`. */
	protected get api(): PluginApi {
		return getApi(this.pluginStore).for(this.manifest.id);
	}

	/** Contribute rail items / routes / settings to the shell frame. */
	protected contribute(contribution: ShellContribution): void {
		this.pluginStore.executeFunction(
			"twodb.shell.contribute",
			this.manifest.id,
			contribution,
		);
	}

	/** Navigate the shell to a full path (e.g. viewPrefix(this.manifest.id)). */
	protected navigate(path: string): void {
		this.pluginStore.executeFunction("twodb.shell.navigate", path);
	}
}
