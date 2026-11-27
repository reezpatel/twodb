import { useRef, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@twodb/blocks";
import { artisanClient, type MemoryInfo } from "../../../lib/artisan-client.js";
import { OvertypeEditor } from "../../../components/ui/overtype-editor.js";
import { cn } from "../../../lib/cn.js";

/** Rough token estimate: ~4 characters per token. */
const estimateTokens = (text: string) => (text ? Math.ceil(text.length / 4) : 0);
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Edit one memory in a dialog: title, content, token estimate, copy, delete,
 * Discard / Save (⌘S). Layout adapted from the chatcn system-prompt editor.
 */
export function MemoryDialog(props: {
  memory: MemoryInfo;
  levelLabel: string;
  onClose: () => void;
  onSaved: (m: MemoryInfo) => void;
  onDelete: () => void;
}) {
  const { memory } = props;
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const dirty = title.trim() !== memory.title || content.trim() !== memory.content;
  const canSave = dirty && !saving && title.trim() !== "" && content.trim() !== "";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      props.onSaved(await artisanClient.updateMemory(memory.id, { title, content }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => undefined);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent
        showClose={false}
        onOpenAutoFocus={(e) => {
          // Focus the markdown editor, not the title input.
          e.preventDefault();
          editorRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        }}
        className="flex h-[40vh] min-h-[320px] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            void save();
          }
        }}
      >
        <DialogDescription className="sr-only">Edit memory</DialogDescription>
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-outline pl-4 pr-2">
          <DialogTitle className="sr-only">{memory.title}</DialogTitle>
          <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{props.levelLabel}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
            className="h-8 min-w-0 flex-1 bg-transparent text-[14px] font-normal outline-none"
          />
          <button
            type="button"
            aria-label={copied ? "Copied" : "Copy memory"}
            title="Copy"
            onClick={copy}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={editorRef} className="flex min-h-0 flex-1 flex-col">
          <OvertypeEditor
            key={`${memory.id}-${resetKey}`}
            value={memory.content}
            onChange={setContent}
            onSave={() => void save()}
            ariaLabel="Content"
            placeholder="Write the memory in markdown…"
            fontSize="12px"
            className="min-h-0 flex-1 overflow-hidden"
          />
        </div>

        <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline py-1.5 pl-4 pr-2">
          <span className="text-[12px] tabular-nums text-ink-muted">≈ {estimateTokens(content).toLocaleString()} tokens</span>
          <span className="flex-1" />
          <p aria-live="polite" className={cn("flex min-w-0 items-center gap-1.5 text-[12px]", err ? "text-destructive" : dirty ? "text-ink" : "text-ink-muted")}>
            {saved && !dirty ? <Check className="size-3.5 shrink-0" /> : dirty && !err ? <span className="size-1.5 shrink-0 rounded-full bg-ink" /> : null}
            <span className="min-w-0 truncate">{err ?? (saving ? "Saving" : saved && !dirty ? "Saved" : dirty ? "Unsaved changes" : "")}</span>
          </p>
          <span className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" title="Forget this memory" onClick={props.onDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              Delete
            </Button>
            {dirty && !saving ? (
              <Button size="sm" variant="ghost" onClick={() => { setTitle(memory.title); setContent(memory.content); setErr(null); setResetKey((n) => n + 1); }}>Discard</Button>
            ) : null}
            <Button size="sm" variant="primary" disabled={!canSave} title={`Save (${isMac() ? "⌘S" : "Ctrl+S"})`} onClick={() => void save()}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : null}
              Save
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

