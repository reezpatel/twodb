import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminRepo } from "../lib/admin-api";

export function usePlugins() {
	const queryClient = useQueryClient();

	const pluginsQuery = useQuery({
		queryKey: ["admin", "plugins"],
		queryFn: () => adminRepo.listPlugins(),
	});

	const templatesQuery = useQuery({
		queryKey: ["admin", "plugin-templates"],
		queryFn: () => adminRepo.listPluginTemplates(),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin", "plugins"] });

	const addPlugin = useMutation({
		mutationFn: (identifier: string) => adminRepo.addPlugin(identifier),
		onSuccess: invalidate,
	});

	const removePlugin = useMutation({
		mutationFn: (identifier: string) => adminRepo.removePlugin(identifier),
		onSuccess: invalidate,
	});

	return { pluginsQuery, templatesQuery, addPlugin, removePlugin };
}
