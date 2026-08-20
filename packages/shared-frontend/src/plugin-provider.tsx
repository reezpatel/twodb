import type { ViewPluginManifest } from "@twodb/contracts";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  createPluginStore,
  PluginProvider,
  RendererPlugin,
} from "react-pluggable";
import { CorePlugin } from "./core/core-plugin";

export type TwoDbPluginCtx = {};

export type TwoDbPluginProviderProps = {
  children: ReactNode;
  plugins?: ViewPluginManifest[];
};

const ProviderContext = createContext<TwoDbPluginCtx | null>(null);

const pluginStore = createPluginStore();

pluginStore.install(new RendererPlugin());
pluginStore.install(new CorePlugin());

export const TwoDbPluginProvider: React.FC<TwoDbPluginProviderProps> = ({
  children,
  plugins = [],
}) => {
  useEffect(() => {
    for (const plugin of plugins) {
      pluginStore.install(plugin.plugin);
    }
  }, []);

  const providers = (plugins ?? [])
    .filter(
      (
        p,
      ): p is ViewPluginManifest & {
        provider: NonNullable<ViewPluginManifest["provider"]>;
      } => Boolean(p.provider),
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const wrapped = providers.reduceRight<ReactNode>(
    (acc, { provider: Provider }) => <Provider>{acc}</Provider>,
    children,
  );

  return (
    <PluginProvider pluginStore={pluginStore}>
      <ProviderContext.Provider value={null}>
        {wrapped}
      </ProviderContext.Provider>
    </PluginProvider>
  );
};

export const useTwoDbPlugin = () => {
  const ctx = useContext(ProviderContext);

  if (!ctx) {
    throw new Error(
      "ProviderContext is missing, please provider ProviderContext through TwoDbPluginProvider",
    );
  }

  return ctx;
};
