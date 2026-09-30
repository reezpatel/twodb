import { useState } from "react";
import { Database, FolderOpen, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useStorage, type StorageBackend } from "./use-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function BackendForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { create, setActionError } = useStorage();
  const [name, setName] = useState("");
  const [type, setType] = useState<"object" | "block">("object");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(true);
  const [rootPath, setRootPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    const config: Record<string, string | boolean> =
      type === "object" ? { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle } : { rootPath };
    try {
      const row = await create.mutateAsync({ name: name.trim().toLowerCase(), type, config });
      if ("warning" in row && row.warning) setActionError(String(row.warning));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="backend-name">Name</Label>
        <Input id="backend-name" placeholder="e.g. minio-main" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Type</Label>
        <div className="bg-muted inline-flex rounded-lg border p-0.5">
          {(
            [
              { id: "object", label: "S3 bucket", icon: Database },
              { id: "block", label: "Local path", icon: HardDrive },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors ${
                type === option.id ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setType(option.id)}
            >
              <option.icon size={13} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {type === "object" ? (
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="s3-key">Access key</Label>
              <Input id="s3-key" placeholder="accessKeyId" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="s3-secret">Secret key</Label>
              <Input
                id="s3-secret"
                type="password"
                placeholder="secretAccessKey"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Path-style access</p>
              <p className="text-muted-foreground text-xs">Use for MinIO and most self-hosted S3 servers.</p>
            </div>
            <Switch checked={forcePathStyle} onCheckedChange={setForcePathStyle} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-root">Root path</Label>
          <Input id="local-root" placeholder="/srv/twodb-storage" value={rootPath} onChange={(e) => setRootPath(e.target.value)} />
          <p className="text-muted-foreground text-xs">Absolute directory on the server. Each org gets its own subfolder.</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Add backend
        </Button>
      </div>
    </div>
  );
}

function BackendRow({ backend }: { backend: StorageBackend }) {
  const { update, test, sync, onDelete } = useStorage();
  const [message, setMessage] = useState<string | null>(null);

  const testNow = async () => {
    setMessage(null);
    const res = await test.mutateAsync(backend.id);
    setMessage(res.ok ? "connection ok" : `test failed: ${res.error}`);
  };

  const syncNow = async () => {
    setMessage(null);
    try {
      const res = await sync.mutateAsync(backend.id);
      setMessage(`synced ${res.files} files / ${res.folders} folders`);
    } catch (e) {
      setMessage(`sync failed: ${(e as Error).message}`);
    }
  };

  return (
    <li className="bg-card flex flex-row items-center gap-3 rounded-xl border p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {backend.name}
          <Badge variant={backend.type === "object" ? "default" : "secondary"} className="text-[10px]">
            {backend.type === "object" ? "object" : "block"}
          </Badge>
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {backend.type === "object"
            ? `${String(backend.config.bucket ?? "")} · ${String(backend.config.endpoint ?? "")}`
            : String(backend.config.rootPath ?? "")}
        </div>
        {message && <div className="text-muted-foreground mt-1 text-xs">{message}</div>}
      </div>
      <Button variant="ghost" size="sm" onClick={() => void testNow()} disabled={test.isPending}>
        {test.isPending && test.variables === backend.id ? <Loader2 className="animate-spin" /> : null}
        Test
      </Button>
      <Button variant="ghost" size="sm" title="Scan backend into the tracking table" onClick={() => void syncNow()} disabled={sync.isPending}>
        {sync.isPending && sync.variables === backend.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Sync
      </Button>
      <Switch checked={backend.enabled} onCheckedChange={(enabled) => update.mutate({ id: backend.id, patch: { enabled } })} title="Enable / disable" />
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(backend)}>
        <FolderOpen className="hidden" />
        Delete
      </Button>
    </li>
  );
}

export function StorageSection() {
  const { backends, actionError, onSaved } = useStorage();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Storage</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add backend
        </Button>
      </div>

      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      {backends.isPending ? (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : backends.data && backends.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {backends.data.map((backend) => (
            <BackendRow key={backend.id} backend={backend} />
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No storage backends</CardTitle>
            <CardDescription>
              Add one or more S3 buckets or local paths. Every backend is mounted as a root folder; files are tracked per organization for the file manager.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add storage backend</DialogTitle>
            <DialogDescription>server-wide — files inside are scoped per org</DialogDescription>
          </DialogHeader>
          <BackendForm
            onSaved={() => {
              setOpen(false);
              onSaved();
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
