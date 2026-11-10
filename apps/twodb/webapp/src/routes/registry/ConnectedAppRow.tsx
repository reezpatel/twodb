import { useAppLifecycle } from "./hooks/useAppsRegistry.js";
import { AppRow } from "./partials/AppRow.js";
import type { RegisteredAppSummary } from "../../lib/gateway-client.js";

/** Component (not a partial): owns this row's lifecycle polling + actions. */
export function ConnectedAppRow({ app, onChanged }: { app: RegisteredAppSummary; onChanged: () => void }) {
  const { status, busy, act, remove } = useAppLifecycle(app.slug);
  return (
    <AppRow
      app={app}
      status={status}
      busy={busy}
      onAction={act}
      onRemove={async () => {
        await remove();
        onChanged();
      }}
    />
  );
}
