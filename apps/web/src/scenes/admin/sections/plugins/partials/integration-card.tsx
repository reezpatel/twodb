import { Badge, Button, Switch } from "@twodb/ui";
import type { IntegrationCatalogItem } from "../../../hooks/use-plugins-section";
import type { PluginsSectionState } from "./plugins-section.types";
import { integrationCardStyles } from "./integration-card.style";

function placeholderUrl(name: string): string {
  const label = name.slice(0, 2).toUpperCase();
  return `https://placehold.co/72x72/F2F0F7/40404E/png?text=${encodeURIComponent(label)}`;
}

export function IntegrationCard({ integration, state }: { integration: IntegrationCatalogItem; state: PluginsSectionState }) {
  const pending = state.pendingIdentifier === integration.identifier;

  return (
    <article className="plugins-card">
      <style jsx>{integrationCardStyles}</style>
      <div className="plugins-card__body">
        <div className="plugins-card__identity">
          <div>
            <h2>{integration.name}</h2>
            <p title={integration.identifier}>{integration.pluginId || integration.identifier}</p>
          </div>
          <img src={integration.logo || placeholderUrl(integration.name)} alt="" width={72} height={72} />
        </div>
        <p className="plugins-card__description">{integration.description}</p>
      </div>

      <footer className="plugins-card__footer">
        <div className="plugins-card__meta">
          <Badge size="sm">{integration.custom ? "Custom" : "Template"}</Badge>
          {integration.version ? <span>v{integration.version}</span> : null}
        </div>
        <div className="plugins-card__actions">
          {integration.connected ? (
            <Button variant="ghost" size="sm" onClick={() => state.openIntegration(integration.identifier)}>
              View
            </Button>
          ) : null}
          {integration.custom ? (
            <Button variant="danger" size="sm" disabled={state.pendingIdentifier !== null} onClick={() => state.removeIntegration(integration.identifier)}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          ) : (
            <Switch
              label={pending ? "Updating…" : integration.connected ? "Connected" : "Add"}
              checked={integration.connected}
              disabled={state.pendingIdentifier !== null}
              onChange={() => state.toggleIntegration(integration.identifier, integration.connected)}
            />
          )}
        </div>
      </footer>
    </article>
  );
}
