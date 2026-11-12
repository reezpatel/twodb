import { useApiKeys } from "./hooks/useApiKeys.js";
import { CreateKeyDialog } from "./partials/CreateKeyDialog.js";
import { EmptyKeys } from "./partials/EmptyKeys.js";
import { KeysTable } from "./partials/KeysTable.js";
import { RawKeyBanner } from "./partials/RawKeyBanner.js";
import { PaneHeader } from "../shell/partials/PaneHeader.js";

/** Only calls its holding hook and renders partials. */
export function ApiKeysView() {
  const k = useApiKeys();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <PaneHeader action={<CreateKeyDialog busy={k.busy} onCreate={k.create} />} />

      {k.error ? (
        <p role="alert" className="mb-4 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {k.error}
        </p>
      ) : null}

      <RawKeyBanner
        rawKey={k.freshRawKey}
        visible={k.secretVisible}
        copied={k.copied}
        onToggleVisible={k.toggleSecretVisible}
        onCopy={() => void k.copySecret()}
        onDismiss={k.dismissRawKey}
      />

      {k.loading && k.keys.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline bg-card shadow-[0_1px_2px_rgba(0,0,0,.025)]">
          {k.keys.length === 0 ? (
            <EmptyKeys />
          ) : (
            <KeysTable
              keys={k.keys}
              busy={k.busy}
              confirmingId={k.confirmingId}
              onStartRevoke={k.startRevoke}
              onCancelRevoke={k.cancelRevoke}
              onRevoke={(id) => void k.revoke(id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
