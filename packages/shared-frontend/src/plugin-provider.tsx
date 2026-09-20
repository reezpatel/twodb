import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPluginStore, PluginProvider, RendererPlugin, type IPlugin } from "react-pluggable";
import { CorePlugin } from "./core/core-plugin";
import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "./api";
import type { PluginNavItem, ViewPlugin, ViewPluginInitContext, ViewPluginRouteProps } from "./plugin";

export type TwoDbPluginCtx = {
  plugins: ViewPlugin[];
};

export type TwoDbPluginProviderProps = {
  children: ReactNode;
  plugins?: ViewPlugin[];
};

const ProviderContext = createContext<TwoDbPluginCtx | null>(null);

const pluginStore = createPluginStore();

pluginStore.install(new RendererPlugin());
pluginStore.install(new CorePlugin());

const api = new ApiClient("plugins");

const safeGet = async (url: string) => {
  try {
    const res = await fetch(url);

    if (res.status !== 200) return null;

    return res.text();
  } catch {
    return null;
  }
};

const getViewPlugin = async (id: string): Promise<{ view: ViewPlugin; styles: string | null } | null> => {
  try {
    const m = (await import(`/@twodb-plugin-view/${encodeURIComponent(id)}/main.js`)) as {
      default?: ViewPlugin;
    };
    if (!m.default) return null;

    const styles = await safeGet(api.resolve(`/${id}/view/styles.css`));

    if (id !== m.default.id) {
      throw new Error(`Plugin id mismatch: expected ${id}, got ${m.default.id}`);
    }

    return { view: m.default, styles };
  } catch (e) {
    console.error(`[twodb] plugin view "${id}" failed to load — continuing without it`, e);
    return null;
  }
};

const useViewPlugins = () => {
  const { data, isLoading } = useQuery({
    queryFn: async () => {
      const listed = await api.get<{ id: string }[]>("");
      const loaded = await Promise.all(listed.map((plugin) => getViewPlugin(plugin.id)));

      return loaded.filter((plugin) => plugin !== null);
    },
    queryKey: ["plugins", "views"],
  });

  return {
    plugins: data ?? [],
    isLoading,
  };
};

const toStorePlugin = (view: ViewPlugin): IPlugin => ({
  pluginStore,
  getPluginName: () => view.id,
  getDependencies: () => [],
  init: () => {},
  activate: () => {},
  deactivate: () => {},
});

const navItems = new Map<string, PluginNavItem>();
const pluginRoutes = new Map<string, React.FC<ViewPluginRouteProps>>();
const mergedFunctions = new Set<string>();
const initialized = new Set<string>();

const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

pluginStore.addFunction("core.navigate", navigate);
pluginStore.addFunction("core::get_routes", () =>
  [...pluginRoutes.entries()].map(([path, Component]) => ({
    path: path.replace(/^\//, ""),
    element: <Component path={path} navigate={navigate} />,
  })),
);
pluginStore.addFunction("core::get_nav_items", () => [...navItems.values()]);

// Two-phase like the api loader: every plugin's functions merge into the
// registry BEFORE any init runs, so inits can invoke each other regardless of
// load order. Idempotent guards make StrictMode's double render safe.
const runRegistryPhase = (views: ViewPlugin[]) => {
  for (const view of views) {
    for (const [name, fn] of Object.entries(view.functions ?? {})) {
      pluginStore.addFunction(name, fn);
      mergedFunctions.add(`${view.id}:${name}`);
    }
  }

  for (const view of views) {
    if (initialized.has(view.id)) continue;
    initialized.add(view.id);

    for (const [path, Component] of Object.entries(view.routes ?? {})) {
      pluginRoutes.set(path, Component);
    }

    if (!view.init) continue;

    const ctx: ViewPluginInitContext = {
      pluginId: view.id,
      invoke: (name, ...args) => pluginStore.executeFunction(name, ...args),
      addFunction: (name, fn) => pluginStore.addFunction(name, fn),
      addNavItem: (item) => navItems.set(`${view.id}:${item.id}`, item),
      emit: (event) => pluginStore.dispatchEvent(event),
      on: (type, listener) => pluginStore.addEventListener(type, listener),
    };
    void view.init(ctx);
  }
};

export const TwoDbPluginProvider: React.FC<TwoDbPluginProviderProps> = ({ children }) => {
  const { plugins, isLoading } = useViewPlugins();
  const installedViews = useRef(new Set<string>());

  const flatPlugins = useMemo(() => plugins.map((p) => p.view), [plugins]);

  useMemo(() => {
    runRegistryPhase(flatPlugins);
  }, [flatPlugins]);

  useEffect(() => {
    for (const plugin of plugins) {
      if (installedViews.current.has(plugin.view.id)) continue;

      installedViews.current.add(plugin.view.id);
      pluginStore.install(toStorePlugin(plugin.view));

      if (!plugin.styles) continue;

      const style = document.createElement("style");
      style.dataset.plugin = plugin.view.id;
      style.textContent = plugin.styles;
      document.head.appendChild(style);
    }
  }, [plugins]);

  const providers = plugins.flatMap((plugin) => plugin.view.providers ?? []).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const wrapped = providers.reduceRight<ReactNode>((acc, { provider: Provider }) => <Provider>{acc}</Provider>, children);

  if (isLoading) {
    return <>isLoading</>;
  }

  return (
    <PluginProvider pluginStore={pluginStore}>
      <ProviderContext.Provider value={{ plugins: flatPlugins }}>{wrapped}</ProviderContext.Provider>
    </PluginProvider>
  );
};

export const useTwoDbPlugin = () => {
  const ctx = useContext(ProviderContext);

  if (!ctx) {
    throw new Error("ProviderContext is missing, please provider ProviderContext through TwoDbPluginProvider");
  }

  return ctx;
};

export function useHook<T>(name: string) {
  const { plugins } = useTwoDbPlugin();

  const hooks: Record<string, () => T> = {};

  for (const plugin of plugins) {
    for (const provider of plugin.providers ?? []) {
      Object.assign(hooks, provider.hooks ?? {});
    }
  }

  if (!hooks[name]) return null;

  return hooks[name]();
}
