import { useAppsRegistryData, useAddExternalApp } from "./hooks/useAppsRegistry.js";
import { ConnectedAppRow } from "./ConnectedAppRow.js";
import { AddExternalDialog } from "./partials/AddExternalDialog.js";
import { AppsSkeleton } from "./partials/AppsSkeleton.js";
import { AppsTable } from "./partials/AppsTable.js";
import { catalogEntryToSummary } from "../../lib/gateway-client.js";
import { formatAppName } from "../../lib/app-name.js";
import { isAvailable } from "../../lib/app-state.js";
import { PaneHeader } from "../shell/partials/PaneHeader.js";

/** Only calls its holding hook and renders partials. Apps already on this host come first; the
 * catalog's not-yet-installed apps follow under "Available". */
export function AppsRegistry() {
  const { apps, catalog, loading, refresh } = useAppsRegistryData();
  const addExternal = useAddExternalApp(refresh);

  const all = [...apps, ...catalog.filter((c) => !apps.some((a) => a.slug === c.slug)).map((c) => catalogEntryToSummary(c))].sort((a, b) =>
    formatAppName(a.name).localeCompare(formatAppName(b.name)),
  );
  const installed = all.filter((a) => !isAvailable(a));
  const available = all.filter(isAvailable);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <PaneHeader action={<AddExternalDialog onAdd={addExternal.add} busy={addExternal.busy} error={addExternal.error} />} />

      {loading && all.length === 0 ? (
        <AppsSkeleton />
      ) : (
        <>
          {installed.length > 0 ? (
            <AppsTable title="Installed" count={installed.length}>
              {installed.map((app) => (
                <ConnectedAppRow key={app.slug} app={app} onChanged={refresh} />
              ))}
            </AppsTable>
          ) : null}
          {available.length > 0 ? (
            <AppsTable title="Available" count={available.length}>
              {available.map((app) => (
                <ConnectedAppRow key={app.slug} app={app} onChanged={refresh} />
              ))}
            </AppsTable>
          ) : null}
        </>
      )}
    </div>
  );
}
