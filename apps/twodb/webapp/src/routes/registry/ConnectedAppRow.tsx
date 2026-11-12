import { useAppLifecycle } from "./hooks/useAppsRegistry.js";
import { AppRow } from "./partials/AppRow.js";
import type { RegisteredAppSummary } from "../../lib/gateway-client.js";

/** Component (not a partial): owns this row's lifecycle polling + actions. */
export function ConnectedAppRow({ app, onChanged }: { app: RegisteredAppSummary; onChanged: () => void }) {
  const { status, busy, act, remove, rotate } = useAppLifecycle(app.slug);
  return (
    <AppRow
      app={app}
      running={app.managed && status?.containerStatus === "running"}
      busy={busy || app.installStatus === "installing"}
      onAction={act}
      onRotateToken={async () => {
        if (!confirm(`Rotate the token for "${app.slug}"? The current token stops working immediately${app.managed ? " and the container is restarted with the new one" : ""}.`)) return;
        try {
          const r = await rotate();
          if (r) {
            await navigator.clipboard?.writeText(r.token).catch(() => {});
            // Shown once — only the hash is stored. Already copied to the clipboard when allowed.
            window.prompt(`New token for ${app.slug} (valid until ${r.expiresAt ?? "revoked"}). Copy it now — it won't be shown again:`, r.token);
          }
        } catch (err) {
          alert(`Token rotation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        onChanged();
      }}
      onRemove={async () => {
        await remove();
        onChanged();
      }}
    />
  );
}
