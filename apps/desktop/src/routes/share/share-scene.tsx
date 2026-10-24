import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, Database, FileText, Folder, HardDrive, Link2, Loader2, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatFileSize } from "../files/upload-dialog";
import {
  addToNotes,
  isInstagram,
  saveLink,
  saveToFiles,
  sendToChat,
  shareMode,
  sharedUrl,
  siteOf,
  useChatChannels,
  useNoteDatabases,
  useNoteTree,
  useSharedContentSettings,
  useSharedPayload,
  useStorageBuckets,
  useStorageFolder,
  type NoteTarget,
  type SharedPayload,
} from "./use-share";

interface Done {
  message: string;
  to: string;
}

/** /share — share-target receiver. Shows the shared payload and lets the user
 *  pick what to do with it: files → storage/chat/notes, text → chat/notes,
 *  links → a locked shared_content database. */
export function ShareScene() {
  const [params] = useSearchParams();
  const payload = useSharedPayload(params);
  const [action, setAction] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const navigate = useNavigate();

  if (payload.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" size={18} />
      </div>
    );
  }

  if (payload.isError || !payload.data) {
    return (
      <Center>
        <p className="text-destructive text-sm">{payload.error?.message ?? "Could not read the shared content."}</p>
        <Button size="sm" variant="outline" onClick={() => navigate("/")}>
          Go home
        </Button>
      </Center>
    );
  }

  const data = payload.data;
  const mode = shareMode(data);
  const url = sharedUrl(data);

  if (done) {
    return (
      <Center>
        <div className="bg-green-500/10 text-green-500 flex h-10 w-10 items-center justify-center rounded-full">
          <Check size={20} />
        </div>
        <p className="text-sm font-medium">{done.message}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(done.to)}>
            Open
          </Button>
          <Button size="sm" onClick={() => navigate("/")}>
            Done
          </Button>
        </div>
      </Center>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-16 pb-16">
        <div className="flex items-center gap-2">
          <Share2 size={16} className="text-muted-foreground" />
          <h1 className="text-lg font-semibold">Shared content</h1>
        </div>

        {/* payload preview */}
        <div className="border-border space-y-1.5 rounded-lg border p-3">
          {data.title && <p className="text-sm font-medium">{data.title}</p>}
          {url && (
            <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
              <Link2 size={11} className="shrink-0" /> {url}
            </p>
          )}
          {data.text && data.text !== url && <p className="text-muted-foreground line-clamp-3 text-xs whitespace-pre-wrap">{data.text}</p>}
          {data.files.length > 0 && (
            <ul className="space-y-0.5">
              {data.files.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs">
                  <FileText size={11} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground/60 shrink-0">{formatFileSize(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {mode === "link" && url ? (
          <LinkPanel payload={data} url={url} onDone={setDone} />
        ) : (
          <div className="space-y-2">
            <ActionButton
              icon={<HardDrive size={14} />}
              label="Save to files"
              hint="Upload to a storage bucket"
              show={mode === "file"}
              active={action === "files"}
              onClick={() => setAction(action === "files" ? null : "files")}
            />
            {action === "files" && mode === "file" && <FilesPanel payload={data} onDone={setDone} />}

            <ActionButton
              icon={<MessageSquare size={14} />}
              label="Send to chat"
              hint="Post to a chat channel"
              show
              active={action === "chat"}
              onClick={() => setAction(action === "chat" ? null : "chat")}
            />
            {action === "chat" && <ChatPanel payload={data} onDone={setDone} />}

            <ActionButton
              icon={<FileText size={14} />}
              label="Add to notes"
              hint="New row in a database, or nested page in a note"
              show
              active={action === "notes"}
              onClick={() => setAction(action === "notes" ? null : "notes")}
            />
            {action === "notes" && <NotesPanel payload={data} onDone={setDone} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">{children}</div>;
}

function ActionButton({ icon, label, hint, show, active, onClick }: { icon: React.ReactNode; label: string; hint: string; show: boolean; active: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button
      className={cn("border-border hover:bg-accent/60 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left", active && "border-ring bg-accent")}
      onClick={onClick}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
      <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", active && "rotate-90")} />
    </button>
  );
}

/* ---------- link → shared_content ---------- */

function LinkPanel({ payload, url, onDone }: { payload: SharedPayload; url: string; onDone: (d: Done) => void }) {
  const settings = useSharedContentSettings();
  const navigate = useNavigate();
  const instagram = isInstagram(url);
  const databases = (settings.data?.databases ?? []).filter((d) => !d.deletedAt);

  const defaultDb = useMemo(() => {
    const t = settings.data?.targets;
    if (!t) return null;
    return (instagram ? (t.instagram ?? t.default) : t.default) ?? databases[0]?.id ?? null;
  }, [settings.data, databases, instagram]);

  const [databaseId, setDatabaseId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [process, setProcess] = useState(instagram);
  const effectiveDb = databaseId ?? defaultDb;

  const save = useMutation({
    mutationFn: () =>
      saveLink({
        databaseId: effectiveDb!,
        url,
        text: payload.text,
        title: payload.title || siteOf(url) || url,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        process,
      }),
    onSuccess: (row) => onDone({ message: `Saved (${row.status})`, to: "/apps/notes/databases" }),
  });

  if (settings.isPending) return <Loader2 className="text-muted-foreground mx-auto animate-spin" size={16} />;

  if (databases.length === 0) {
    return (
      <div className="border-border space-y-2 rounded-lg border p-4 text-center">
        <p className="text-muted-foreground text-sm">No shared-content database yet.</p>
        <Button size="sm" onClick={() => navigate("/apps/settings/shared-content")}>
          Create one in Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <label className="text-muted-foreground block text-xs font-medium">Save to database</label>
      <select
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
        value={effectiveDb ?? ""}
        onChange={(e) => setDatabaseId(e.target.value)}
      >
        {databases.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title || "Untitled database"}
          </option>
        ))}
      </select>

      <label className="text-muted-foreground block text-xs font-medium">Tags (comma separated)</label>
      <Input className="h-8 text-sm" placeholder="e.g. inspiration, reels" value={tags} onChange={(e) => setTags(e.target.value)} />

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={process} onCheckedChange={(v) => setProcess(v === true)} />
        Process content
        {instagram && <span className="text-muted-foreground text-xs">(default for Instagram)</span>}
      </label>

      {save.isError && <p className="text-destructive text-xs">{save.error.message}</p>}
      <Button size="sm" className="w-full" disabled={!effectiveDb || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
        Save{process ? " & queue processing" : ""}
      </Button>
    </div>
  );
}

/* ---------- files → storage ---------- */

function FilesPanel({ payload, onDone }: { payload: SharedPayload; onDone: (d: Done) => void }) {
  const buckets = useStorageBuckets();
  const [bucket, setBucket] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const folder = useStorageFolder(bucket, path);

  const upload = useMutation({
    mutationFn: () => saveToFiles(bucket!, path, payload.files),
    onSuccess: () => onDone({ message: `Uploaded ${payload.files.length} file${payload.files.length === 1 ? "" : "s"}`, to: "/apps/files" }),
  });

  if (buckets.isPending) return <Loader2 className="text-muted-foreground mx-auto animate-spin" size={16} />;
  if ((buckets.data ?? []).length === 0) return <p className="text-muted-foreground px-2 text-xs">No storage buckets — create one in Files first.</p>;

  const folders = (folder.data ?? []).filter((e) => e.type === "folder");
  const crumbs = path ? path.split("/") : [];

  return (
    <div className="border-border space-y-2 rounded-lg border p-3">
      <select
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
        value={bucket ?? ""}
        onChange={(e) => {
          setBucket(e.target.value || null);
          setPath("");
        }}
      >
        <option value="">Select bucket…</option>
        {(buckets.data ?? []).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.backendName})
          </option>
        ))}
      </select>

      {bucket && (
        <>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
            <button className="hover:text-foreground" onClick={() => setPath("")}>
              root
            </button>
            {crumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <span>/</span>
                <button className="hover:text-foreground" onClick={() => setPath(crumbs.slice(0, i + 1).join("/"))}>
                  {seg}
                </button>
              </span>
            ))}
          </div>
          <div className="max-h-36 overflow-y-auto">
            {folders.map((f) => {
              const name = f.path.split("/").pop()!;
              return (
                <button key={f.path} className="hover:bg-accent/60 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs" onClick={() => setPath(f.path)}>
                  <Folder size={12} className="text-muted-foreground" /> {name}
                </button>
              );
            })}
            {folders.length === 0 && !folder.isPending && <p className="text-muted-foreground/60 px-2 py-1 text-xs">No subfolders</p>}
          </div>
        </>
      )}

      {upload.isError && <p className="text-destructive text-xs">{upload.error.message}</p>}
      <Button size="sm" className="w-full" disabled={!bucket || upload.isPending} onClick={() => upload.mutate()}>
        {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
        Upload here
      </Button>
    </div>
  );
}

/* ---------- text/files → chat ---------- */

function ChatPanel({ payload, onDone }: { payload: SharedPayload; onDone: (d: Done) => void }) {
  const channels = useChatChannels();
  const [selected, setSelected] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => sendToChat(selected!, payload),
    onSuccess: () => onDone({ message: "Sent to chat", to: "/apps/chat" }),
  });

  if (channels.isPending) return <Loader2 className="text-muted-foreground mx-auto animate-spin" size={16} />;
  const list = (channels.data ?? []).filter((ch) => !ch.archivedAt);
  if (list.length === 0) return <p className="text-muted-foreground px-2 text-xs">No chat channels yet.</p>;

  return (
    <div className="border-border space-y-2 rounded-lg border p-3">
      <div className="max-h-48 overflow-y-auto">
        {list.map((ch) => (
          <button
            key={ch.id}
            className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent/60", selected === ch.id && "bg-accent")}
            onClick={() => setSelected(ch.id)}
          >
            <MessageSquare size={13} className="text-muted-foreground shrink-0" />
            <span className="min-w-0 flex-1 truncate">{ch.name}</span>
            {selected === ch.id && <Check size={13} className="text-green-500" />}
          </button>
        ))}
      </div>
      {send.isError && <p className="text-destructive text-xs">{send.error.message}</p>}
      <Button size="sm" className="w-full" disabled={!selected || send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
        Send
      </Button>
    </div>
  );
}

/* ---------- text/files → notes ---------- */

function NotesPanel({ payload, onDone }: { payload: SharedPayload; onDone: (d: Done) => void }) {
  const tree = useNoteTree();
  const databases = useNoteDatabases();
  const [target, setTarget] = useState<NoteTarget | null>(null);
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: () => addToNotes(target!, payload),
    onSuccess: () => onDone({ message: target!.kind === "database" ? "Added as database row" : "Added as nested note", to: "/apps/notes" }),
  });

  const targets = useMemo<NoteTarget[]>(() => {
    const nodes = tree.data?.nodes ?? [];
    const dbLock = new Map((databases.data?.databases ?? []).map((d) => [d.id, d]));
    const pages: NoteTarget[] = nodes
      .filter((n) => n.kind !== "database" && !n.isRow)
      .map((n) => ({ kind: "page", id: n.id, title: n.title || "Untitled", schemaLockedBy: null }));
    const dbs: NoteTarget[] = nodes
      .filter((n) => n.kind === "database")
      .map((n) => ({ kind: "database", id: n.id, title: n.title || "Untitled database", schemaLockedBy: dbLock.get(n.id)?.schemaLockedBy ?? null }));
    const q = search.trim().toLowerCase();
    const all = [...dbs, ...pages];
    return q ? all.filter((t) => t.title.toLowerCase().includes(q)) : all;
  }, [tree.data, databases.data, search]);

  if (tree.isPending || databases.isPending) return <Loader2 className="text-muted-foreground mx-auto animate-spin" size={16} />;

  return (
    <div className="border-border space-y-2 rounded-lg border p-3">
      <Input className="h-8 text-sm" placeholder="Search notes & databases…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-48 overflow-y-auto">
        {targets.map((t) => (
          <button
            key={`${t.kind}:${t.id}`}
            className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent/60", target?.id === t.id && "bg-accent")}
            onClick={() => setTarget(t)}
          >
            {t.kind === "database" ? <Database size={13} className="text-lavender-400 shrink-0" /> : <FileText size={13} className="text-muted-foreground shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="text-muted-foreground/60 shrink-0 text-[10px]">{t.kind === "database" ? "row" : "nested page"}</span>
            {target?.id === t.id && <Check size={13} className="text-green-500" />}
          </button>
        ))}
        {targets.length === 0 && <p className="text-muted-foreground/60 px-2 py-1 text-xs">No matches</p>}
      </div>
      {save.isError && <p className="text-destructive text-xs">{save.error.message}</p>}
      <Button size="sm" className="w-full" disabled={!target || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        Add to notes
      </Button>
    </div>
  );
}
