import { useAppsRegistryData, useAddExternalApp } from "./hooks/useAppsRegistry.js";
import { ConnectedAppCard } from "./ConnectedAppCard.js";
import { AddExternalDialog } from "./partials/AddExternalDialog.js";

/** Only calls its holding hook and renders partials. */
export function AppsRegistry() {
  const { apps, loading, refresh } = useAppsRegistryData();
  const addExternal = useAddExternalApp(refresh);

  const managed = apps.filter((a) => a.managed);
  const external = apps.filter((a) => !a.managed);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium text-muted-foreground">Apps</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Everything behind one gateway</h2>
        <p className="mt-4 text-[15px] text-muted-foreground">
          Managed apps are installed and lifecycle-controlled by the control plane. External apps are URL entries the
          gateway routes to — their lifecycle stays wherever they run.
        </p>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="mt-10">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Managed
              <span className="rounded-full border border-outline bg-paper px-2 py-0.5 text-xs">{managed.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {managed.map((app) => (
                <ConnectedAppCard key={app.slug} app={app} onChanged={refresh} />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                External
                <span className="rounded-full border border-outline bg-paper px-2 py-0.5 text-xs">{external.length}</span>
              </h3>
              <AddExternalDialog onAdd={addExternal.add} busy={addExternal.busy} error={addExternal.error} />
            </div>
            {external.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-outline bg-stone/60 px-4 py-6 text-center text-sm text-muted-foreground">
                No external apps registered yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {external.map((app) => (
                  <ConnectedAppCard key={app.slug} app={app} onChanged={refresh} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
