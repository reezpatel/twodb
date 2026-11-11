import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@twodb/blocks";
import { useEnrollTokens } from "./hooks/useEnrollTokens.js";
import { NewTokenDialog } from "./partials/NewTokenDialog.js";
import type { EnrollToken } from "../../lib/dispatch-client.js";

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
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          One token, many machines — each <code className="font-mono text-[12px]">two-runner --enroll</code> connect mints its own runner identity and per-runner key.
        </p>
        <Button size="sm" variant="primary" onClick={() => setNewOpen(true)}>
          <Plus className="size-3.5" />
          New token
        </Button>
      </div>
      {tokens.error ? <p className="text-[13px] text-destructive">{tokens.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tokens.tokens.map((t) => (
          <TokenCard key={t.id} token={t} busy={tokens.busy} onDelete={() => void tokens.remove(t.id)} />
        ))}
      </div>
      {tokens.tokens.length === 0 && !tokens.error ? (
        <p className="p-6 text-center text-[13px] text-ink-muted">No enrollment tokens yet.</p>
      ) : null}
      {newOpen ? (
        <NewTokenDialog busy={tokens.busy} onClose={() => setNewOpen(false)} onCreate={(input) => tokens.create(input)} />
      ) : null}
    </div>
  );
}

function TokenCard(props: { token: EnrollToken; busy: boolean; onDelete: () => void }) {
  const t = props.token;
  const expired = t.expiresAt && Date.parse(t.expiresAt) < Date.now();
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 truncate text-[14px] font-medium text-ink">
              <KeyRound className="size-3.5 text-ink-muted" />
              {t.name}
            </h3>
            <p className="mt-1 text-[12px] text-ink-muted">
              {t.enrollCount} machine{t.enrollCount === 1 ? "" : "s"} enrolled
            </p>
          </div>
          {expired ? <Badge tone="danger">expired</Badge> : <Badge tone="neutral">active</Badge>}
        </div>
        <p className="text-[11px] text-ink-muted">
          {t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt)}` : "never used"}
          {t.expiresAt ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}` : " · no expiry"}
        </p>
        <Button size="sm" variant="ghost" disabled={props.busy} onClick={props.onDelete}>
          <Trash2 className="size-3.5" />
          Revoke
        </Button>
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
