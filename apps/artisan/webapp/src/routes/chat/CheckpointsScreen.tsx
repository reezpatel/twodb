import { useState } from "react";
import { Check, Copy, History, Loader2, MoreVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useSessionSide, type Checkpoint } from "./hooks/useSessionSide.js";

/** Shared by the header and every row so columns line up (same pattern as the TwoDB apps table). */
const COLUMNS = "sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_2.25rem]";

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const auto = trigger !== "manual";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px]", auto ? "bg-info/10 text-info" : "bg-surface-muted text-ink-muted")}>
      {trigger || "manual"}
    </span>
  );
}

function RowMenu(props: { checkpoint: Checkpoint; busy: boolean; onRestore: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const label = props.checkpoint.label ?? props.checkpoint.commitSha.slice(0, 8);
  const item = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-surface-muted disabled:opacity-50";
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${label} actions`}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink data-[state=open]:bg-surface-muted data-[state=open]:text-ink"
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-outline bg-surface p-1 shadow-lg">
            <p className="truncate px-2 py-1 text-[11px] font-medium text-ink-muted">{label}</p>
            <button
              type="button"
              className={item}
              disabled={props.busy}
              onClick={() => {
                setOpen(false);
                void navigator.clipboard.writeText(props.checkpoint.commitSha);
              }}
            >
              <Copy className="size-3.5" /> Copy SHA
            </button>
            <button
              type="button"
              className={item}
              disabled={props.busy}
              onClick={() => {
                setOpen(false);
                if (confirm(`Restore "${label}"? Files in the directory are reset to this checkpoint.`)) props.onRestore();
              }}
            >
              <RotateCcw className="size-3.5" /> Restore
            </button>
            <div className="my-1 h-px bg-outline" />
            <button
              type="button"
              className={cn(item, "text-destructive")}
              disabled={props.busy}
              onClick={() => {
                setOpen(false);
                if (confirm(`Delete checkpoint "${label}"?`)) props.onDelete();
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CheckpointRow(props: { checkpoint: Checkpoint; busy: boolean; onRestore: () => void; onDelete: () => void }) {
  const cp = props.checkpoint;
  const [copied, setCopied] = useState(false);
  const copySha = () => {
    void navigator.clipboard.writeText(cp.commitSha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className={cn("group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-stone/50", COLUMNS)}>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">{cp.label ?? "checkpoint"}</p>
      </div>
      <div className="justify-self-end sm:col-start-5 sm:row-start-1">
        <RowMenu checkpoint={cp} busy={props.busy} onRestore={props.onRestore} onDelete={props.onDelete} />
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted sm:contents">
        <span>
          <TriggerBadge trigger={cp.trigger} />
        </span>
        <span title={new Date(cp.createdAt).toLocaleString()}>{timeAgo(cp.createdAt)}</span>
        <button type="button" onClick={copySha} title="Copy SHA" className="flex items-center gap-1.5 justify-self-start font-mono text-[11px] hover:text-ink">
          {cp.commitSha.slice(0, 10)}
          {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
        </button>
      </div>
    </div>
  );
}

/** Checkpoints tab: git-ref snapshots of the session directory, shown as a table. */
export function CheckpointsScreen(props: { sessionId: string }) {
  const side = useSessionSide(props.sessionId);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const git = side.git;

  const create = async () => {
    setError(null);
    try {
      await side.createCheckpoint(label.trim());
      setLabel("");
    } catch {
      setError("checkpoint failed — is the directory a git repo? (git init first)");
    }
  };

  if (git && git.git === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
        <History className="size-7 opacity-50" />
        <p className="text-[13px] font-medium">Not a git repository</p>
        <p className="max-w-xs text-center text-[11px]">Checkpoints snapshot the session directory via hidden git refs. Run `git init` in the terminal tab first.</p>
      </div>
    );
  }

  const list = side.checkpoints;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-outline px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">
          Checkpoints <span className="ml-1 font-normal text-ink-muted">{list.length}</span>
        </h3>
        <span className="ml-auto" />
        <input
          value={label}
          placeholder="Label (optional)"
          className="h-8 w-56 rounded-md border border-outline bg-paper px-2.5 text-[12px] outline-none placeholder:text-ink-muted focus:border-ink-muted"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !side.busy) void create();
          }}
        />
        <button
          type="button"
          disabled={side.busy}
          onClick={() => void create()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
        >
          {side.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Checkpoint
        </button>
      </div>
      {error ? <p className="px-4 py-1.5 text-[11px] text-destructive">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline px-4 py-12 text-center text-ink-muted">
            <History className="size-6 opacity-50" />
            <p className="text-[13px] font-medium text-ink">No checkpoints yet</p>
            <p className="text-[12px]">Capture one before risky changes — you can restore it anytime.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline bg-surface shadow-[0_1px_2px_rgba(0,0,0,.025)]">
            <div
              aria-hidden
              className={cn(
                "hidden items-center gap-x-4 border-b border-outline bg-stone/70 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-muted sm:grid",
                COLUMNS,
              )}
            >
              <span>Checkpoint</span>
              <span>Trigger</span>
              <span>Created</span>
              <span>Commit</span>
              <span />
            </div>
            <div className="divide-y divide-outline">
              {list.map((cp) => (
                <CheckpointRow
                  key={cp.id}
                  checkpoint={cp}
                  busy={side.busy}
                  onRestore={() => void side.restoreCheckpoint(cp.id)}
                  onDelete={() => void side.deleteCheckpoint(cp.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
