import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { AppShellHeader, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, RadioGroup, RadioGroupItem } from "@twodb/blocks";

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Extra actions on the right (boot buttons, refresh, etc). */
  actions?: ReactNode;
  /** Fired from the global Add runner button. */
  onCreateRunner: (input: { name?: string; kind: "host" | "microvm-host" }) => Promise<{ key: string } | null>;
}

/** App-wide header: page title + actions; owns the Add-runner dialog. */
export function AppHeader(props: AppHeaderProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <AppShellHeader className="flex h-14 shrink-0 items-center gap-3 border-b border-outline px-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-none text-ink">{props.title}</h1>
        {props.subtitle ? <p className="mt-1 truncate text-[12px] leading-none text-ink-muted">{props.subtitle}</p> : null}
      </div>
      {props.actions}
      <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
        <Plus className="size-3.5" />
        Add runner
      </Button>
      <AddRunnerDialog open={addOpen} onOpenChange={setAddOpen} onCreate={props.onCreateRunner} />
    </AppShellHeader>
  );
}

function AddRunnerDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (input: { name?: string; kind: "host" | "microvm-host" }) => Promise<{ key: string } | null>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"host" | "microvm-host">("host");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await props.onCreate({ name: name.trim() || undefined, kind });
      if (res) setCreated({ name: name.trim() || "(generated)", key: res.key });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => { props.onOpenChange(o); if (!o) { setCreated(null); setName(""); setKind("host"); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Runner created" : "Add runner"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-muted">
              Start two-runner on the machine with this key — it's shown <strong>only once</strong>:
            </p>
            <pre className="overflow-x-auto rounded-md border border-outline bg-surface-muted p-3 text-[11px] leading-relaxed">
two-runner --gateway {window.location.origin} \
  --key {created.key} --name {created.name}
            </pre>
            <Button size="sm" variant="secondary" onClick={() => props.onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="runner-name">Friendly name</Label>
              <Input id="runner-name" value={name} placeholder="divine (auto-generated when empty)" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Runner kind</Label>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as "host" | "microvm-host")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="host" id="kind-host" />
                  <Label htmlFor="kind-host" className="cursor-pointer font-normal">host — runs commands directly</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="microvm-host" id="kind-mvm" />
                  <Label htmlFor="kind-mvm" className="cursor-pointer font-normal">microvm-host — also boots Firecracker microvms (/dev/kvm)</Label>
                </div>
              </RadioGroup>
            </div>
            {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? "Creating…" : "Create"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
