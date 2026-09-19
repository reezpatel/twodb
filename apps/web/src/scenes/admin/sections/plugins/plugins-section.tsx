import { Button, SearchInput, Segmented } from "@twodb/ui";
import { Plus } from "lucide-react";
import { usePluginsSection } from "../../hooks/use-plugins-section";
import { pluginsSectionStyles } from "./plugins-section.style";
import { CatalogContent } from "./partials/catalog-content";
import { CustomIntegrationDialog } from "./partials/custom-integration-dialog";
import { PluginDetailDialog } from "./partials/plugin-detail-dialog";

const FILTERS = [
  { id: "all", label: "All integrations" },
  { id: "connected", label: "Connected" },
  { id: "custom", label: "Custom" },
];

export function PluginsSection() {
  const state = usePluginsSection();

  return (
    <section className="plugins-page">
      <style jsx>{pluginsSectionStyles}</style>

      <header className="plugins-page__header">
        <div>
          <h1>Integrations and connected apps</h1>
          <p>Connect twodb with the tools you use every day.</p>
        </div>
        <Button variant="secondary" size="lg" onClick={state.openCustomDialog}>
          <Plus aria-hidden="true" size={16} />
          New integration
        </Button>
      </header>

      <div className="plugins-page__toolbar">
        <div>
          <Segmented
            aria-label="Filter integrations"
            items={FILTERS}
            value={state.filter}
            onValueChange={state.setFilter}
          />
        </div>
        <div className="plugins-page__search">
          <SearchInput
            aria-label="Search integrations"
            placeholder="Search integrations"
            value={state.query}
            onChange={(event) => state.setQuery(event.target.value)}
          />
        </div>
      </div>

      {state.error && !state.customDialogOpen ? (
        <p className="plugins-page__error" role="alert">
          {state.error.message}
        </p>
      ) : null}

      <CatalogContent state={state} />
      <CustomIntegrationDialog state={state} />
      <PluginDetailDialog state={state} />
    </section>
  );
}
