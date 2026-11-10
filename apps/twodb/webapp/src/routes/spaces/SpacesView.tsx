import { useSpaces } from "./hooks/useSpaces.js";
import { CreateSpaceDialog, SpaceRow } from "./partials/SpacesPartials.js";

/** Only calls its holding hook and renders partials. */
export function SpacesView() {
  const { spaces, loading, busy, error, create } = useSpaces();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Spaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sub-scopes of your workspace — app resources link themselves to spaces.
          </p>
        </div>
        <CreateSpaceDialog busy={busy} onCreate={create} />
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : spaces.length === 0 ? (
        <p className="mt-8 rounded-[10px] border border-dashed border-outline bg-stone/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No spaces yet — create one to scope app resources.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[10px] border border-outline bg-paper">
          {spaces.map((s) => (
            <SpaceRow key={s.id} space={s} />
          ))}
        </div>
      )}
    </div>
  );
}
