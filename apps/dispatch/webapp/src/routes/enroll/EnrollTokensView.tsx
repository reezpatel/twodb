import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useEnrollTokens } from "./hooks/useEnrollTokens.js";
import { EnrollTokensTable } from "./partials/EnrollTokensTable.js";
import { NewTokenDialog } from "./partials/NewTokenDialog.js";

/**
 * Enroll tokens page: shared bootstrap credentials. Create one, hand the
 * shown-once command line to any number of machines; each enrolls its own
 * runner identity. Revoke when done onboarding.
 */
export function EnrollTokensView() {
  const tokens = useEnrollTokens();
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    void tokens.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] text-ink-muted">
          Keys that let new machines join as runners.
        </p>
        <Button size="sm" variant="primary" onClick={() => setNewOpen(true)}>
          <Plus className="size-3.5" />
          New key
        </Button>
      </div>
      {tokens.error ? <p className="text-[13px] text-destructive">{tokens.error}</p> : null}
      <EnrollTokensTable tokens={tokens.tokens} busy={tokens.busy} onDelete={(t) => void tokens.remove(t.id)} />
      {newOpen ? (
        <NewTokenDialog busy={tokens.busy} onClose={() => setNewOpen(false)} onCreate={(input) => tokens.create(input)} />
      ) : null}
    </div>
  );
}
