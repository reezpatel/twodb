import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "react-router";
import { usePlugins } from "./use-plugins";

const IDENTIFIER_RE = /^(git:\S+|npm:\S+|local:\S+)$/;

type CatalogFilter = "all" | "connected" | "custom";

export type IntegrationCatalogItem = {
  identifier: string;
  pluginId: string;
  name: string;
  version: string | null;
  description: string;
  logo: string;
  connected: boolean;
  custom: boolean;
};

function displayName(identifier: string, name: string | null): string {
  if (name?.trim()) return name;
  const clean = identifier.replace(/^(git:|npm:|local:)/, "").replace(/\/$/, "");
  const segments = clean
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("."));
  return segments.at(-1)?.replace(/\.git$/, "") || clean || identifier;
}

// Card data comes from the plugin's own manifest (identifier, description,
// logo) whenever it is available — registry rows for not-yet-fetched
// git:/npm: sources have no manifest and fall back to placeholders.
function manifestOf(entry?: { manifest: string | null }): {
  identifier: string;
  description: string;
  logo: string;
} {
  try {
    const parsed = entry?.manifest ? (JSON.parse(entry.manifest) as Record<string, unknown>) : {};
    const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : "");
    return {
      identifier: str(parsed.identifier),
      description: str(parsed.description),
      logo: str(parsed.logo),
    };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { identifier: "", description: "", logo: "" };
  }
}

function descriptionFor(provides: string, custom: boolean): string {
  if (custom) return "Added with a custom npm, Git or local-path identifier.";
  try {
    const capabilities = JSON.parse(provides);
    if (Array.isArray(capabilities) && capabilities.length > 0) {
      return `Provides ${capabilities.slice(0, 3).join(", ")}.`;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return "Ready to connect from the shared integration catalog.";
}

export function usePluginsSection() {
  const navigate = useNavigate();
  const { pluginsQuery, templatesQuery, addPlugin, removePlugin } = usePlugins();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const plugins = pluginsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const catalog = useMemo<IntegrationCatalogItem[]>(() => {
    const installed = new Map(plugins.map((plugin) => [plugin.identifier, plugin]));
    const templateIds = new Set(templates.map((template) => template.identifier));
    const templateItems = templates.map((template) => {
      const manifest = manifestOf(installed.get(template.identifier));
      return {
        identifier: template.identifier,
        pluginId: manifest.identifier,
        name: displayName(template.identifier, template.name),
        version: template.version,
        description: manifest.description || descriptionFor(template.provides, false),
        logo: manifest.logo,
        connected: installed.has(template.identifier),
        custom: false,
      };
    });
    const customItems = plugins
      .filter((plugin) => !templateIds.has(plugin.identifier))
      .map((plugin) => {
        const manifest = manifestOf(plugin);
        return {
          identifier: plugin.identifier,
          pluginId: manifest.identifier,
          name: displayName(plugin.identifier, plugin.name),
          version: plugin.version,
          description: manifest.description || descriptionFor(plugin.provides, true),
          logo: manifest.logo,
          connected: true,
          custom: true,
        };
      });
    return [...templateItems, ...customItems];
  }, [plugins, templates]);

  const visibleIntegrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((integration) => {
      const matchesFilter = filter === "all" || (filter === "connected" && integration.connected) || (filter === "custom" && integration.custom);
      const matchesQuery =
        !normalizedQuery ||
        integration.name.toLowerCase().includes(normalizedQuery) ||
        integration.identifier.toLowerCase().includes(normalizedQuery) ||
        integration.pluginId.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [catalog, filter, query]);

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
    openIntegration: (identifier: string) => navigate(`/admin/plugins/${encodeURIComponent(identifier)}`),
  };
}

export { IDENTIFIER_RE };
