import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTwoDbPlugin } from "@twodb/shared-frontend";
import { adminRepo } from "../lib/admin-api";
import { usePlugins } from "./use-plugins";
import type { PluginEntry } from "../lib/admin-api";

const IDENTIFIER_RE = /^(git:\S+|npm:\S+|local:\S+)$/;

type CatalogFilter = "all" | "connected" | "custom";

export type IntegrationCatalogItem = {
  plugin: PluginEntry;
  connected: boolean;
};

export function usePluginsSection() {
  const queryClient = useQueryClient();
  const { pluginsQuery, templatesQuery, addPlugin, removePlugin } = usePlugins();
  const { plugins: viewPlugins } = useTwoDbPlugin();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [detailIdentifier, setDetailIdentifier] = useState<string | null>(null);
  const plugins = pluginsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const catalog = useMemo<IntegrationCatalogItem[]>(() => {
    const items = plugins.map((plugin) => ({
      plugin,
      connected: true,
    }));

    return items;
  }, [plugins, templates]);

  const visibleIntegrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalog.filter((integration) => {
      const matchesFilter = filter === "all" || (filter === "connected" && integration.connected);

      const str = [integration.plugin.manifest?.name, integration.plugin.identifier, ...(integration.plugin.manifest?.tags ?? [])];

      const matchesQuery = !normalizedQuery || str.some((s) => (s ?? "").toLocaleLowerCase().includes(normalizedQuery));

      return matchesFilter && matchesQuery;
    });
  }, [catalog, filter, query]);

  const detailPlugin = useMemo(() => {
    if (detailIdentifier === null) return null;
    const entry = catalog.find((integration) => integration.plugin.identifier === detailIdentifier);
    return entry ? { ...entry.plugin, connected: entry.connected } : null;
  }, [catalog, detailIdentifier]);

  const settingsFor = (pluginId: string) => viewPlugins.find((view) => view.id === pluginId)?.admin?.settings ?? null;

  const form = useForm({
    defaultValues: { identifier: "" },
    onSubmit: async ({ value, formApi }) => {
      await addPlugin.mutateAsync(value.identifier.trim());
      formApi.reset();
      setCustomDialogOpen(false);
    },
  });

  const closeCustomDialog = () => {
    setCustomDialogOpen(false);
    form.reset();
    addPlugin.reset();
  };
  let pendingIdentifier: string | null = null;
  if (addPlugin.isPending) pendingIdentifier = addPlugin.variables;
  if (removePlugin.isPending) pendingIdentifier = removePlugin.variables;

  return {
    catalog,
    visibleIntegrations,
    query,
    setQuery,
    filter,
    setFilter: (value: string) => setFilter(value as CatalogFilter),
    customDialogOpen,
    openCustomDialog: () => {
      addPlugin.reset();
      setCustomDialogOpen(true);
    },
    closeCustomDialog,
    form,
    isLoading: pluginsQuery.isPending || templatesQuery.isPending,
    error: addPlugin.error ?? removePlugin.error ?? pluginsQuery.error ?? templatesQuery.error,
    customError: addPlugin.error,
    pendingIdentifier,
    toggleIntegration: (identifier: string, connected: boolean) => {
      if (connected) removePlugin.mutate(identifier);
      else addPlugin.mutate(identifier);
    },
    removeIntegration: (identifier: string) => removePlugin.mutate(identifier),
    detailPlugin,
    openDetail: (identifier: string) => setDetailIdentifier(identifier),
    closeDetail: () => setDetailIdentifier(null),
    settingsFor,
    updatePluginConfig: async (identifier: string, config: unknown) => {
      await adminRepo.updatePluginConfig(identifier, config);
      await queryClient.invalidateQueries({ queryKey: ["admin", "plugins"] });
    },
  };
}

export { IDENTIFIER_RE };
