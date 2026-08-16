import type { ViewPluginManifest } from "@twodb/contracts";
import { createContext, useContext, type ReactNode } from "react";

export type TwoDbPluginCtx = {};

export type TwoDbPluginProviderProps = {
  children: ReactNode;
  plugins?: ViewPluginManifest[];
};

const ProviderContext = createContext<TwoDbPluginCtx | null>(null);

export const TwoDbPluginProvider: React.FC<TwoDbPluginProviderProps> = ({
  children,
  plugins,
}) => {
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
    <ProviderContext.Provider value={null}>{wrapped}</ProviderContext.Provider>
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
