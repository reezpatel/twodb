import { useSpaces } from "./hooks/useSpaces.js";
import { CreateSpaceDialog } from "./partials/CreateSpaceDialog.js";
import { EmptySpaces } from "./partials/EmptySpaces.js";
import { SpacesTable } from "./partials/SpacesTable.js";
import { PaneHeader } from "../shell/partials/PaneHeader.js";

/** Only calls its holding hook and renders partials. */
export function SpacesView() {
  const s = useSpaces();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <PaneHeader action={<CreateSpaceDialog busy={s.busy} onCreate={s.create} />} />

      {s.error ? (
        <p role="alert" className="mb-4 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {s.error}
        </p>
      ) : null}

      {s.loading && s.spaces.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline bg-card shadow-[0_1px_2px_rgba(0,0,0,.025)]">
          {s.spaces.length === 0 ? <EmptySpaces /> : <SpacesTable spaces={s.spaces} copiedId={s.copiedId} onCopyId={(id) => void s.copyId(id)} />}
        </div>
      )}
    </div>
  );
}
