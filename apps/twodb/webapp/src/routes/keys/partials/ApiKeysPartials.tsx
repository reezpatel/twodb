import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button, Chip, Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger, Input, Label, cn } from "@twodb/blocks";
import type { ApiKeyMeta } from "../../../lib/gateway-client.js";

/** Dumb/presentational — the one-time raw key banner after creation. */
export function RawKeyBanner({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-outline bg-stone p-3">
      <p className="text-[13px] font-semibold text-ink">
        Copy this key now — it will never be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-[6px] border border-outline bg-paper px-2 py-1.5 font-mono text-xs whitespace-nowrap">
          {rawKey}
        </code>
        <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(rawKey)} aria-label="Copy key">
          <Copy className="size-3.5" />
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="self-start px-0" onClick={onDismiss}>
        I've saved it
      </Button>
    </div>
  );
}

/** Dumb/presentational — the create-key dialog (name field only). */
export function CreateKeyDialog({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Generate key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {/* Not rendered visually as a heading; description below carries the context. */}
        <DialogTitle className="sr-only">Generate API key</DialogTitle>
        <div className="flex flex-col gap-2">
          <Label htmlFor="key-name">Key name</Label>
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. twodb-cli on my laptop"
          />
          <p className="text-[13px] text-ink-muted">
            The raw key (<code className="font-mono">twodb_…</code>) is shown exactly once, right after creation. Only its
            SHA-256 hash is stored. Use it as the <code className="font-mono">x-api-key</code> header on gateway calls.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || busy}
            onClick={() => {
              onCreate(name.trim());
              setName("");
              setOpen(false);
            }}
          >
            {busy ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dumb/presentational — one key row. */
export function KeyRow({ k, busy, onRevoke }: { k: ApiKeyMeta; busy: boolean; onRevoke: () => void }) {
  const revoked = k.revokedAt !== null;
  return (
    <div className={cn("flex items-center gap-3 border-b border-outline px-4 py-3 last:border-b-0", revoked && "opacity-50")}>
      <KeyRound className="size-4 shrink-0 text-ink-muted" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{k.name}</span>
          {revoked ? <Chip tone="danger">revoked</Chip> : null}
          {k.lastUsedAt ? (
            <span className="text-[11px] text-ink-muted">used {new Date(k.lastUsedAt).toLocaleDateString()}</span>
          ) : null}
        </div>
        <code className="font-mono text-xs text-ink-muted">twodb_{k.prefix}_…</code>
      </div>
      {!revoked ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (confirm(`Revoke key "${k.name}"? Requests using it will immediately get 401.`)) onRevoke();
          }}
        >
          <Trash2 className="size-3.5" />
          Revoke
        </Button>
      ) : null}
    </div>
  );
}
