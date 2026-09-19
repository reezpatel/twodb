import type { PluginsSectionState } from "./plugins-section.types";
import { EmptyCatalog } from "./empty-catalog";
import { IntegrationCard } from "./integration-card";
import { LoadingGrid } from "./loading-grid";
import { catalogContentStyles } from "./catalog-content.style";

export function CatalogContent({ state }: { state: PluginsSectionState }) {
	if (state.isLoading) return <LoadingGrid />;
	if (state.visibleIntegrations.length === 0) {
		return <EmptyCatalog state={state} />;
	}

	return (
		<div className="plugins-grid">
			<style jsx>{catalogContentStyles}</style>
			{state.visibleIntegrations.map((integration) => (
				<IntegrationCard
					key={integration.plugin.identifier}
					integration={integration}
					state={state}
				/>
			))}
		</div>
	);
}
