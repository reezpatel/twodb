import { useAppsRegistry } from "./hooks/useAppsRegistry.js";
import { AppRow } from "./partials/AppRow.js";
import { ConnectionStringBanner } from "./partials/ConnectionStringBanner.js";

/** Only calls its holding hook and renders partials. */
export function AppsRegistry() {
  const { apps, loading, provisioning, result, provisionAndRefresh, dismissResult } = useAppsRegistry();

  return (
    <div className="twodb-apps-registry">
      <h1>Registered apps</h1>
      {result ? (
        <ConnectionStringBanner
          slug={result.slug}
          connectionString={result.connectionString}
          onDismiss={dismissResult}
        />
      ) : null}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Base path</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <AppRow
                key={app.slug}
                app={app}
                provisioning={provisioning === app.slug}
                onProvision={() => provisionAndRefresh(app.slug)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
