import { useState } from "react";
import { Database, HardDrive, KeyRound, Plus, Star, Trash2, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Switch, cn } from "@twodb/blocks";
import { formatFileSize } from "../../lib/drive-client.js";
import { useDrive } from "../hooks/useDrive.js";
import { useAccessKeys, useAppOverrides, useBackends, useStorages } from "../hooks/useSettings.js";

// ---------------------------------------------------------------------------
// Settings — mirrors the legacy storage settings: backend cards with
// S3/local forms, virtual storage create, default-for-apps selection, app
// overrides, S3 access keys.
// ---------------------------------------------------------------------------

function BackendCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create, busy, error } = useBackends();
  const [name, setName] = useState("");
  const [type, setType] = useState<"s3" | "local">("s3");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(true);
  const [rootPath, setRootPath] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    const config =
      type === "s3"
        ? { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }
        : { rootPath };
    const ok = await create({ name: name.trim().toLowerCase(), type, config });
    if (ok) {
      setName("");
      setEndpoint("");
      setBucket("");
      setAccessKeyId("");
      setSecretAccessKey("");
      setRootPath("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add storage backend</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="backend-name">Name</Label>
            <Input id="backend-name" placeholder="e.g. minio-main" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <div className="inline-flex rounded-lg border bg-muted p-0.5">
              {(
                [
                  { id: "s3", label: "S3 bucket", icon: Database },
                  { id: "local", label: "Local path", icon: HardDrive },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
                    type === option.id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setType(option.id)}
                >
                  <option.icon size={13} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {type === "s3" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s3-endpoint">Endpoint</Label>
                <Input id="s3-endpoint" placeholder="http://localhost:9000" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s3-bucket">Bucket</Label>
                  <Input id="s3-bucket" placeholder="twodb" value={bucket} onChange={(e) => setBucket(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s3-region">Region</Label>
                  <Input id="s3-region" placeholder="us-east-1" value={region} onChange={(e) => setRegion(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s3-key">Access key ID</Label>
                <Input id="s3-key" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s3-secret">Secret access key</Label>
                <Input id="s3-secret" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="s3-path-style" checked={forcePathStyle} onCheckedChange={setForcePathStyle} />
                <Label htmlFor="s3-path-style">Force path style</Label>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="local-root">Root path</Label>
              <Input id="local-root" placeholder="/var/lib/twodb/drive" value={rootPath} onChange={(e) => setRootPath(e.target.value)} />
              <p className="text-xs text-muted-foreground">The server must be able to read/write this directory.</p>
            </div>
          )}
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy && <Loader2 size={13} className="animate-spin" />} Test & save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StorageCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { backends } = useDrive();
  const { create, busy, error } = useStorages();
  const [name, setName] = useState("");
  const [backendId, setBackendId] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);

  const submit = async () => {
    if (!name.trim() || !backendId) return;
    const ok = await create({ name: name.trim(), backendId, setAsDefault });
    if (ok) {
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New virtual storage</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="vs-name">Name</Label>
            <Input id="vs-name" placeholder="e.g. personal-drive" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vs-backend">Backend</Label>
            <select
              id="vs-backend"
              className="h-8 w-full rounded-md border border-outline bg-background px-2 text-sm"
              value={backendId}
              onChange={(e) => setBackendId(e.target.value)}
            >
              <option value="">Select backend…</option>
              {backends.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="vs-default" checked={setAsDefault} onCheckedChange={setSetAsDefault} />
            <Label htmlFor="vs-default">Use as default for app files</Label>
          </div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || !backendId}>
            {busy && <Loader2 size={13} className="animate-spin" />} Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessKeysCard({ storageId, storageName }: { storageId: string; storageName: string }) {
  const { keys, create, remove, loading } = useAccessKeys(storageId);
  const [created, setCreated] = useState<{ accessKeyId: string; secretAccessKey: string } | null>(null);
  const [label, setLabel] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={15} /> S3 API keys — {storageName}
        </CardTitle>
        <CardDescription>
          Credentials for the S3-compatible endpoint of this virtual storage
          (<code className="text-[11px]">/apps/twodrive/s3/{storageId}/…</code>). The secret is shown once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {created && (
          <div className="rounded-lg border bg-muted/50 p-3 text-xs">
            <p className="mb-1 font-medium">Save these now — the secret will not be shown again:</p>
            <p>
              access key id: <code className="font-mono">{created.accessKeyId}</code>
            </p>
            <p>
              secret: <code className="font-mono">{created.secretAccessKey}</code>
            </p>
            <p className="mt-1 text-muted-foreground">
              Use with <code>x-amz-access-key-id</code> + <code>x-amz-secret</code> headers (simplified auth, not SigV4).
            </p>
          </div>
        )}
        {loading && <p className="text-xs text-muted-foreground">Loading keys…</p>}
        {keys.map((key) => (
          <div key={key.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
            <code className="font-mono text-xs">{key.accessKeyId}</code>
            <span className="text-xs text-muted-foreground">{key.label}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {key.lastUsedAt ? `used ${new Date(key.lastUsedAt).toLocaleString()}` : "never used"}
            </span>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
              title="Revoke"
              onClick={() => {
                if (window.confirm(`Revoke key ${key.accessKeyId}?`)) void remove(key.id);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!loading && keys.length === 0 && <p className="text-xs text-muted-foreground">No keys yet.</p>}
        <div className="flex gap-2">
          <Input className="h-8 flex-1" placeholder="Label (e.g. rclone)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void create(label.trim() || undefined)
                .then((k) => {
                  setCreated(k);
                  setLabel("");
                })
                .catch((e) => window.alert(e.message))
            }
          >
            <Plus size={13} /> Create key
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsScene() {
  const { backends, storages, activeStorageId, refreshTree } = useDrive();
  const { setDefault, remove: removeStorage, error: storageError } = useStorages();
  const { remove: removeBackend, test: testBackend } = useBackends();
  const { overrides, set: setOverride } = useAppOverrides();
  const [backendDialog, setBackendDialog] = useState(false);
  const [storageDialog, setStorageDialog] = useState(false);
  const [newAppId, setNewAppId] = useState("");

  const activeStorage = storages.find((s) => s.id === activeStorageId) ?? null;
  const defaultStorage = storages.find((s) => s.isDefault) ?? null;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Storage settings</h2>
          <p className="text-xs text-muted-foreground">
            Backends hold the bytes; virtual storages are soft buckets carved out of them. Every virtual storage appears
            in the sidebar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={backends.length === 0} onClick={() => setStorageDialog(true)}>
            <Plus size={13} /> Virtual storage
          </Button>
          <Button size="sm" onClick={() => setBackendDialog(true)}>
            <Plus size={13} /> Backend
          </Button>
        </div>
      </header>

      {storageError && (
        <p className="mb-4 text-sm text-red-500" role="alert">
          {storageError}
        </p>
      )}

      {/* Default virtual storage for app files */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star size={15} /> Default storage for app files
          </CardTitle>
          <CardDescription>
            Apps that insert files via the internal API (x-twodb-app) get a dedicated folder inside this virtual
            storage. Without a default (and without a per-app override below), those calls fail with
            <code className="text-[11px]"> no_default_storage</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <select
            className="h-8 w-64 rounded-md border border-outline bg-background px-2 text-sm"
            value={defaultStorage?.id ?? ""}
            onChange={(e) => void setDefault(e.target.value || null)}
          >
            <option value="">— none (apps can't insert) —</option>
            {storages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {defaultStorage && (
            <span className="text-xs text-muted-foreground">
              {defaultStorage.usage.files} files · {formatFileSize(defaultStorage.usage.used)}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Per-app overrides */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Per-app storage overrides</CardTitle>
          <CardDescription>Point a specific app's file folder at a different virtual storage.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm">
              <code className="w-32 shrink-0 truncate font-mono text-xs">{o.appId}</code>
              <select
                className="h-8 flex-1 rounded-md border border-outline bg-background px-2 text-sm"
                value={o.virtualStorageId}
                onChange={(e) => void setOverride(o.appId, e.target.value || null)}
              >
                <option value="">— use default —</option>
                {storages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                title="Remove override"
                onClick={() => void setOverride(o.appId, null)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {overrides.length === 0 && <p className="text-xs text-muted-foreground">No overrides — every app uses the default.</p>}
          <div className="flex gap-2 pt-1">
            <Input className="h-8 w-40" placeholder="app id, e.g. twomail" value={newAppId} onChange={(e) => setNewAppId(e.target.value)} />
            <select
              className="h-8 flex-1 rounded-md border border-outline bg-background px-2 text-sm"
              value=""
              onChange={(e) => {
                if (newAppId.trim() && e.target.value) {
                  void setOverride(newAppId.trim().toLowerCase(), e.target.value);
                  setNewAppId("");
                }
              }}
            >
              <option value="">Point at virtual storage…</option>
              {storages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Backends */}
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Backends</h3>
      <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {backends.map((backend) => {
          const children = storages.filter((s) => s.backendId === backend.id);
          return (
            <Card key={backend.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {backend.type === "s3" ? <Database size={15} className="text-lavender-400" /> : <HardDrive size={15} className="text-blue-400" />}
                  {backend.name}
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">{backend.type}</span>
                </CardTitle>
                <CardDescription>
                  {children.length} virtual storage{children.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {children.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                    {s.isDefault && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground">{formatFileSize(s.usage.used)}</span>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete virtual storage"
                      onClick={() => {
                        const hard = window.confirm(
                          `"${s.name}" registration will be removed.\n\nOK = also delete its FILES from the backend permanently.\nCancel = keep the bytes (registration + tracking only).`,
                        );
                        void removeStorage(s.id, hard);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div className="mt-1 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void testBackend(backend.id).then((r) => window.alert(r.ok ? "Backend reachable" : `Failed: ${r.error}`))}>
                    Test
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={children.length > 0}
                    title={children.length > 0 ? "Delete its virtual storages first" : undefined}
                    onClick={() => {
                      if (window.confirm(`Delete backend "${backend.name}"? Files on the backend are not deleted.`)) {
                        void removeBackend(backend.id).then(() => refreshTree());
                      }
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {backends.length === 0 && (
          <p className="text-xs text-muted-foreground">No backends — add an S3 bucket or a local path to start.</p>
        )}
      </div>

      {/* Access keys for the active virtual storage */}
      {activeStorage && <AccessKeysCard storageId={activeStorage.id} storageName={activeStorage.name} />}

      <BackendCreateDialog open={backendDialog} onOpenChange={setBackendDialog} />
      <StorageCreateDialog open={storageDialog} onOpenChange={setStorageDialog} />
    </main>
  );
}
