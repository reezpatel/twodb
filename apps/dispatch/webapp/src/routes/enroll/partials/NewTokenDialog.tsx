import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";

export interface NewTokenDialogProps {
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { name?: string; expiresInDays?: number }) => Promise<{ token: { name: string }; key: string } | null>;
}

/** Token launcher: name + expiry; the token shows exactly once with the
 *  two-runner --enroll command line to hand to machines. */
export function NewTokenDialog(props: NewTokenDialogProps) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const res = await props.onCreate({
        name: name.trim() || undefined,
        expiresInDays: Number(expiresInDays) || undefined,
      });
      if (res) setCreated({ name: res.token.name, key: res.key });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{created ? "Token created" : "New enrollment token"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-muted">
              Run this on any machine to join — shown <strong>only once</strong>:
            </p>
            <pre className="overflow-x-auto rounded-md border border-outline bg-surface-muted p-3 text-[11px] leading-relaxed">
two-runner --gateway {window.location.origin} \\
  --enroll {created.key} [--name my-machine] [--microvm]
            </pre>
            <p className="text-[12px] text-ink-muted">
              Each machine gets its own identity and runner key; this token can enroll any number of them until revoked or expired.
            </p>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={props.onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="token-name">Name</Label>
              <Input id="token-name" value={name} placeholder="office-machines" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="token-expiry">Expires in (days, empty = never)</Label>
              <Input id="token-expiry" value={expiresInDays} placeholder="30" onChange={(e) => setExpiresInDays(e.target.value)} />
            </div>
            {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={props.onClose}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={props.busy} onClick={() => void submit()}>
                {props.busy ? "Creating…" : "Create token"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
