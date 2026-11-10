import { useAppLifecycle } from "./hooks/useAppsRegistry.js";
import { AppCard } from "./partials/AppCard.js";
import type { RegisteredAppSummary } from "../../lib/gateway-client.js";

/** Component (not a partial): owns this card's lifecycle polling + actions. */
export function ConnectedAppCard({ app, onChanged }: { app: RegisteredAppSummary; onChanged: () => void }) {
  const { status, busy, act, remove } = useAppLifecycle(app.slug);
  return (
    <AppCard
      app={app}
      status={app.managed ? status : null}
      busy={busy}
      onAction={act}
      onRemove={async () => {
        await remove();
        onChanged();
      }}
    />
  );
}
