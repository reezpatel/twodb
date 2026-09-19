import { Badge, Button } from "@twodb/ui";
import type { IntegrationCatalogItem } from "../../../hooks/use-plugins-section";
import type { PluginsSectionState } from "./plugins-section.types";
import { integrationCardStyles } from "./integration-card.style";

function placeholderUrl(name: string): string {
  const label = name.slice(0, 2).toUpperCase();
  return `https://placehold.co/72x72/F2F0F7/40404E/png?text=${encodeURIComponent(label)}`;
}

export function IntegrationCard({ integration, state }: { integration: IntegrationCatalogItem; state: PluginsSectionState }) {
  return (
    <article className="plugins-card">
      <style jsx>{integrationCardStyles}</style>
      <div className="plugins-card__body">
        <div className="plugins-card__identity">
          <div>
            <h2>{integration.plugin.identifier}</h2>
          </div>
          <img src={integration.plugin.manifest?.logo || placeholderUrl(integration.plugin.identifier)} alt="" width={72} height={72} />
        </div>
        <p className="plugins-card__description">{integration.plugin.manifest?.description}</p>
      </div>

      <footer className="plugins-card__footer">
        <div className="plugins-card__meta">{integration.plugin.manifest?.version ? <Badge>v{integration.plugin.manifest.version}</Badge> : null}</div>
        <div className="plugins-card__actions">
          {integration.connected ? (
            <Button variant="ghost" size="sm" onClick={() => state.openDetail(integration.plugin.identifier)}>
              View
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => state.toggleIntegration(integration.plugin.identifier, false)}>
              Install
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}
