import { useAppsRegistryData, useAddExternalApp } from "./hooks/useAppsRegistry.js";
import { ConnectedAppCard } from "./ConnectedAppCard.js";
import { AddExternalDialog } from "./partials/AddExternalDialog.js";
import { catalogEntryToSummary } from "../../lib/gateway-client.js";

/** Only calls its holding hook and renders partials. One flat grid: every
 * registered app plus catalog apps not yet registered. The header holds the
 * add-external-app action. */
export function AppsRegistry() {
  const { apps, catalog, loading, refresh } = useAppsRegistryData();
  const addExternal = useAddExternalApp(refresh);

  const all = [...apps, ...catalog.filter((c) => !apps.some((a) => a.slug === c.slug)).map((c) => catalogEntryToSummary(c))];

  return (
    <div className="mx-auto w-full max-w-8xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Apps</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything behind one gateway.</p>
        </div>
        <AddExternalDialog onAdd={addExternal.add} busy={addExternal.busy} error={addExternal.error} />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((app) => (
            <ConnectedAppCard key={app.slug} app={app} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
