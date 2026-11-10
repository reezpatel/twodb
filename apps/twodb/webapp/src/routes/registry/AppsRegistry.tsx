import { useAppsRegistryData } from "./hooks/useAppsRegistry.js";
import { ConnectedAppRow } from "./ConnectedAppRow.js";

/** Only calls its holding hook and renders partials. */
export function AppsRegistry() {
  const { apps, loading, refresh } = useAppsRegistryData();

  return (
    <div className="twodb-apps-registry">
      <h1>Apps</h1>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Install and lifecycle-manage app containers. Install/upgrade run in the background — rows poll until
        the app registers itself and comes up. See the Gateway explorer tab for each app's API contract.
      </p>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Version</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <ConnectedAppRow key={app.slug} app={app} onChanged={refresh} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
