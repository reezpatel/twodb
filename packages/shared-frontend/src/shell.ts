import { useEffect, useReducer } from "react";
import type { ReactNode } from "react";
import type { IPlugin, PluginStore } from "react-pluggable";
import { viewPrefix, type PluginId } from "@twodb/contracts";

/* ---------- Contribution shapes ---------- */

export interface RailItemContribution {
	/** The owning plugin's id — also the rail item's identity. */
	id: PluginId;
	icon: ReactNode;
	label: string;
	/** Lower sorts first in the rail. */
	order?: number;
}

export interface RouteContribution {
	/** Plugin-local path: "/" or "/inbox". The shell mounts it under
	 *  `/<plugin_id>` automatically. */
	path: string;
	element: ReactNode;
}

export interface ShellContribution {
	railItem?: RailItemContribution;
	routes?: RouteContribution[];
}

export interface MountedRoute {
	pluginId: PluginId;
	/** Full path including the plugin prefix, e.g. "/twodb.notes/inbox". */
	fullPath: string;
	element: ReactNode;
}

/* ---------- Shell state ---------- */

interface ShellState {
	railItems: RailItemContribution[];
	routes: MountedRoute[];
	path: string;
}

interface ShellHost {
	state: ShellState;
	subscribers: Set<() => void>;
	contribute(pluginId: PluginId, contribution: ShellContribution): void;
	navigate(path: string): void;
	notify(): void;
}

const hosts = new WeakMap<PluginStore, ShellHost>();

function getHost(store: PluginStore): ShellHost {
	const host = hosts.get(store);
	if (!host)
		throw new Error("twodb: shell plugin is not installed on this PluginStore");
	return host;
}

function computeState(host: ShellHost): ShellState {
	return host.state;
}

/** Read the shell: rail items (sorted), mounted routes, current path. */
export function useShell(
	store: PluginStore,
): ShellState & { navigate: (path: string) => void } {
	const host = getHost(store);
	const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

	useEffect(() => {
		host.subscribers.add(forceUpdate);
		return () => {
			host.subscribers.delete(forceUpdate);
		};
	}, [host]);

	const state = computeState(host);
	return { ...state, navigate: host.navigate };
}

/* ---------- Core plugin ---------- */

/**
 * Core shell plugin: owns the frame's contribution points and location.
 * View plugins call `twodb.shell.contribute` with data — rail items, routes —
 * and the AppShell re-renders. Contributions are keyed by plugin id, so a
 * plugin can never impersonate another plugin's slice of the frame.
 */
export function createShellPlugin(): IPlugin {
	const railItems = new Map<PluginId, RailItemContribution>();
	const routes = new Map<PluginId, RouteContribution[]>();

	const host: ShellHost = {
		state: { railItems: [], routes: [], path: window.location.pathname },
		subscribers: new Set(),
		notify() {
			host.state = {
				railItems: [...railItems.values()].sort(
					(a, b) => (a.order ?? 0) - (b.order ?? 0),
				),
				routes: [...routes.entries()].flatMap(([pluginId, list]) =>
					list.map((route) => ({
						pluginId,
						fullPath: `${viewPrefix(pluginId)}${route.path === "/" ? "" : route.path}`,
						element: route.element,
					})),
				),
				path: host.state.path,
			};
			for (const subscriber of host.subscribers) subscriber();
		},
		contribute(pluginId, contribution) {
			if (contribution.railItem) railItems.set(pluginId, contribution.railItem);
			if (contribution.routes) routes.set(pluginId, contribution.routes);
			host.notify();
		},
		navigate(path: string) {
			if (path === host.state.path) return;
			window.history.pushState(null, "", path);
			host.state = { ...host.state, path };
			host.notify();
		},
	};

	return {
		pluginStore: undefined as unknown as PluginStore,
		getPluginName: () => "twodb.shell@1.0.0",
		getDependencies: () => ["twodb.bus@1.0.0"],
		init(store: PluginStore) {
			this.pluginStore = store;
			hosts.set(store, host);
			store.addFunction(
				"twodb.shell.contribute",
				(pluginId: PluginId, c: ShellContribution) =>
					host.contribute(pluginId, c),
			);
			store.addFunction("twodb.shell.navigate", (path: string) =>
				host.navigate(path),
			);
			window.addEventListener("popstate", () => {
				host.state = { ...host.state, path: window.location.pathname };
				host.notify();
			});
		},
		activate() {
			host.notify();
		},
		deactivate() {},
	};
}
