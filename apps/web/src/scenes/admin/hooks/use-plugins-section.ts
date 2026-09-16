import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "react-router";
import { usePlugins } from "./use-plugins";

const IDENTIFIER_RE = /^(git:\S+|npm:\S+)$/;

type CatalogFilter = "all" | "connected" | "custom";

export type IntegrationCatalogItem = {
	identifier: string;
	name: string;
	version: string | null;
	description: string;
	connected: boolean;
	custom: boolean;
};

function displayName(identifier: string, name: string | null): string {
	if (name?.trim()) return name;
	const clean = identifier.replace(/^(git:|npm:)/, "").replace(/\/$/, "");
	return clean.split("/").pop() || identifier;
}

function descriptionFor(provides: string, custom: boolean): string {
	if (custom) return "Added with a custom npm or Git identifier.";
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
	const { pluginsQuery, templatesQuery, addPlugin, removePlugin } =
		usePlugins();
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<CatalogFilter>("all");
	const [customDialogOpen, setCustomDialogOpen] = useState(false);
	const plugins = pluginsQuery.data ?? [];
	const templates = templatesQuery.data ?? [];

	const catalog = useMemo<IntegrationCatalogItem[]>(() => {
		const installed = new Map(
			plugins.map((plugin) => [plugin.identifier, plugin]),
		);
		const templateIds = new Set(
			templates.map((template) => template.identifier),
		);
		const templateItems = templates.map((template) => ({
			identifier: template.identifier,
			name: displayName(template.identifier, template.name),
			version: template.version,
			description: descriptionFor(template.provides, false),
			connected: installed.has(template.identifier),
			custom: false,
		}));
		const customItems = plugins
			.filter((plugin) => !templateIds.has(plugin.identifier))
			.map((plugin) => ({
				identifier: plugin.identifier,
				name: displayName(plugin.identifier, plugin.name),
				version: plugin.version,
				description: descriptionFor(plugin.provides, true),
				connected: true,
				custom: true,
			}));
		return [...templateItems, ...customItems];
	}, [plugins, templates]);

	const visibleIntegrations = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return catalog.filter((integration) => {
			const matchesFilter =
				filter === "all" ||
				(filter === "connected" && integration.connected) ||
				(filter === "custom" && integration.custom);
			const matchesQuery =
				!normalizedQuery ||
				integration.name.toLowerCase().includes(normalizedQuery) ||
				integration.identifier.toLowerCase().includes(normalizedQuery);
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
		error:
			addPlugin.error ??
			removePlugin.error ??
			pluginsQuery.error ??
			templatesQuery.error,
		customError: addPlugin.error,
		pendingIdentifier,
		toggleIntegration: (identifier: string, connected: boolean) => {
			if (connected) removePlugin.mutate(identifier);
			else addPlugin.mutate(identifier);
		},
		openIntegration: (identifier: string) =>
			navigate(`/admin/plugins/${encodeURIComponent(identifier)}`),
	};
}

export { IDENTIFIER_RE };
