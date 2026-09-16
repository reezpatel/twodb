import { useLocation, useNavigate } from "react-router";
import { useAdminSession } from "./use-admin-session";
import { usePlugins } from "./use-plugins";

const SECTION_ROUTES = [
	"/admin/passkeys",
	"/admin/instance",
	"/admin/plugins",
] as const;

function pluginRoute(identifier: string): string {
	return `/admin/plugins/${encodeURIComponent(identifier)}`;
}

export function useAdminRail() {
	const location = useLocation();
	const navigate = useNavigate();
	const { logout } = useAdminSession();
	const { pluginsQuery } = usePlugins();
	const pluginItems = (pluginsQuery.data ?? []).map((plugin) => ({
		id: pluginRoute(plugin.identifier),
		label: plugin.name ?? plugin.identifier,
	}));

	const activePlugin = pluginItems.find(
		(item) =>
			location.pathname === item.id ||
			location.pathname.startsWith(`${item.id}/`),
	);
	const activeSection = SECTION_ROUTES.find(
		(route) =>
			location.pathname === route || location.pathname.startsWith(`${route}/`),
	);

	return {
		activeId: activePlugin?.id ?? activeSection ?? "",
		pluginItems,
		navigate,
		logout,
	};
}
