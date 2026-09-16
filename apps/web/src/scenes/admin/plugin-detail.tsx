import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { pluginDetailStyles } from "./plugin-detail.style";
import { adminFetch, type PluginEntry } from "./lib/admin-api";

// Mock detail view for a registered plugin entry. Real metadata lands when
// the fetch endpoint is implemented (see apps/api/src/admin/plan.md).
export function PluginDetail() {
	const { identifier } = useParams<{ identifier: string }>();

	const pluginsQuery = useQuery({
		queryKey: ["admin", "plugins"],
		queryFn: () => adminFetch<PluginEntry[]>("/plugins"),
	});
	const plugin = pluginsQuery.data?.find(
		(entry) => entry.identifier === identifier,
	);

	if (!plugin) return null;

	return (
		<section className="admin__section">
			<style jsx>{pluginDetailStyles}</style>
			<header className="admin__section-header">
				<div>
					<h2 className="admin__section-title">
						{plugin.name ?? plugin.identifier}
					</h2>
					<p className="admin__copy">
						Plugin metadata will appear here once fetching is implemented.
					</p>
				</div>
			</header>

			<dl className="admin__status">
				<div className="admin__status-row">
					<dt>Identifier</dt>
					<dd className="admin__status-value">{plugin.identifier}</dd>
				</div>
				<div className="admin__status-row">
					<dt>Version</dt>
					<dd className="admin__status-value">{plugin.version ?? "—"}</dd>
				</div>
				<div className="admin__status-row">
					<dt>Provides</dt>
					<dd className="admin__status-value">
						{plugin.provides === "[]" ? "—" : plugin.provides}
					</dd>
				</div>
				<div className="admin__status-row">
					<dt>Path</dt>
					<dd className="admin__status-value">
						{plugin.extracted_path ?? "—"}
					</dd>
				</div>
			</dl>
		</section>
	);
}
