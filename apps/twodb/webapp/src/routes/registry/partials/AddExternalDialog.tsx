import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@twodb/blocks";
import { Globe, Plus } from "lucide-react";

export interface AddExternalDialogProps {
  onAdd: (input: { slug: string; name: string; httpUrl: string; basePath?: string }) => Promise<void>;
  busy: boolean;
  error: string | null;
}

/** Dumb/presentational — form fields + open state handled by parent's hook via props. */
export function AddExternalDialog(props: AddExternalDialogProps) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [basePath, setBasePath] = useState("");

  const slugValid = /^[a-z0-9][a-z0-9-]*$/.test(slug.trim());
  const urlValid = /^https?:\/\/.+/.test(httpUrl.trim());
  const canSubmit = slugValid && name.trim() && urlValid && !props.busy;

  async function submit() {
    await props.onAdd({
      slug: slug.trim(),
      name: name.trim(),
      httpUrl: httpUrl.trim(),
      basePath: basePath.trim() || undefined,
    });
    setSlug("");
    setName("");
    setHttpUrl("");
    setBasePath("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="md">
          <Plus className="size-4" aria-hidden /> Add external app
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <span className="flex size-10 items-center justify-center rounded-[10px] border border-outline bg-paper">
            <Globe className="size-5" aria-hidden />
          </span>
          <DialogTitle className="mt-3">Add external app</DialogTitle>
          <DialogDescription>
            Register a URL as a gateway entry. TwoDB routes traffic to it but never installs, stops or upgrades it — the app's lifecycle stays wherever it runs.
          </DialogDescription>
        </DialogHeader>
        {props.error ? (
          <p role="alert" className="rounded-md border border-pin/40 bg-pin/10 px-3 py-2 text-sm text-pin">
            {props.error}
          </p>
        ) : null}
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ext-slug">Slug</Label>
            <Input id="ext-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-legacy-app" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ext-name">Name</Label>
            <Input id="ext-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Legacy App" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ext-url">HTTP URL</Label>
            <Input id="ext-url" value={httpUrl} onChange={(e) => setHttpUrl(e.target.value)} placeholder="http://192.168.2.9:7001" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ext-base">Gateway path (optional)</Label>
            <Input id="ext-base" value={basePath} onChange={(e) => setBasePath(e.target.value)} placeholder={`defaults to /${slug || "slug"}`} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {props.busy ? "Registering…" : "Register app"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
