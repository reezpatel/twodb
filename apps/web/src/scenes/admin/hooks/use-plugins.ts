import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	adminFetch,
	type PluginEntry,
	type PluginTemplateEntry,
} from "../lib/admin-api";

export function usePlugins() {
	const queryClient = useQueryClient();

	const pluginsQuery = useQuery({
		queryKey: ["admin", "plugins"],
		queryFn: () => adminFetch<PluginEntry[]>("/plugins"),
	});

	const templatesQuery = useQuery({
		queryKey: ["admin", "plugin-templates"],
		queryFn: () => adminFetch<PluginTemplateEntry[]>("/plugin-templates"),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin", "plugins"] });

	const addPlugin = useMutation({
		mutationFn: (identifier: string) =>
			adminFetch<PluginEntry>("/plugins", {
				method: "POST",
				body: { identifier },
			}),
		onSuccess: invalidate,
	});

	const removePlugin = useMutation({
		mutationFn: (identifier: string) =>
			adminFetch(`/plugins/${encodeURIComponent(identifier)}`, {
				method: "DELETE",
			}),
		onSuccess: invalidate,
	});

	return { pluginsQuery, templatesQuery, addPlugin, removePlugin };
}
