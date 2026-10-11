import { useState } from "react";
import { ChevronRight, FolderPlus, MoreHorizontal, Palette, Pencil, Plus, Tag, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EmailAccount, EmailLabel } from "../email-api";
import { LABEL_COLORS, MAX_LABEL_DEPTH, useLabelTree, type LabelNode } from "./use-label-tree";

interface LabelTreeProps {
  labels: EmailLabel[];
  accounts: EmailAccount[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function LabelRow({ node, state, activeId, onSelect }: { node: LabelNode; state: ReturnType<typeof useLabelTree>; activeId: string | null; onSelect: (id: string) => void }) {
  const open = state.expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isDropTarget = state.dropTarget === node.id && state.canDrop(node.id);
  const count = open || !hasChildren ? node.unread : node.rolledUnread;

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          state.setDragId(node.id);
        }}
        onDragEnd={() => {
          state.setDragId(null);
          state.setDropTarget(null);
        }}
        onDragOver={(e) => {
          if (!state.canDrop(node.id)) return;
          e.preventDefault();
          state.setDropTarget(node.id);
        }}
        onDragLeave={() => state.dropTarget === node.id && state.setDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault();
          state.drop(node.id);
        }}
        className={cn(
          "group hover:bg-accent/50 flex items-center gap-1 rounded-md py-1 pr-1 text-sm transition-colors",
          activeId === node.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
          isDropTarget && "ring-primary ring-1",
          state.dragId === node.id && "opacity-50",
        )}
        style={{ paddingLeft: 4 + node.depth * 12 }}
      >
        <button
          type="button"
          aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
          className={cn("grid size-4 shrink-0 place-items-center rounded", !hasChildren && "invisible")}
          onClick={() => state.toggle(node.id)}
        >
          <ChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(node.id)}>
          <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: node.effectiveColor ?? "var(--color-muted-foreground)" }} />
          <span className="flex-1 truncate">{node.name}</span>
          {count ? <span className="text-xs tabular-nums">{count}</span> : null}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`${node.name} options`} className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {node.depth < MAX_LABEL_DEPTH ? (
              <DropdownMenuItem onSelect={() => state.setDialog({ kind: "create", parentId: node.id, accountId: node.accountId })}>
                <FolderPlus /> New sub-label
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => state.setDialog({ kind: "rename", label: node })}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette /> Color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <div className="grid grid-cols-4 gap-1.5 p-1.5">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      className={cn("size-5 rounded-sm border", node.color === c && "ring-ring ring-2")}
                      style={{ backgroundColor: c }}
                      onClick={() => state.update.mutate({ id: node.id, patch: { color: c } })}
                    />
                  ))}
                </div>
                {node.parentId ? (
                  <DropdownMenuItem onSelect={() => state.update.mutate({ id: node.id, patch: { color: null } })}>Inherit from parent</DropdownMenuItem>
                ) : null}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {node.parentId ? (
              <DropdownMenuItem onSelect={() => state.update.mutate({ id: node.id, patch: { parentId: null } })}>
                <Undo2 /> Move to top level
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => state.setDialog({ kind: "delete", label: node })}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open ? node.children.map((child) => <LabelRow key={child.id} node={child} state={state} activeId={activeId} onSelect={onSelect} />) : null}
    </>
  );
}

function LabelDialogs({ state, labels, accounts }: { state: ReturnType<typeof useLabelTree>; labels: EmailLabel[]; accounts: EmailAccount[] }) {
  const d = state.dialog;
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("personal");
  const [children, setChildren] = useState<"delete" | "reparent">("reparent");
  const sharedAccounts = accounts.filter((a) => a.visibility === "shared" && a.role !== "viewer");

  const onOpenChange = (open: boolean) => {
    if (!open) {
      state.setDialog(null);
      state.setError(null);
    }
  };

  if (!d) return null;
  if (d.kind === "delete") {
    const hasChildren = labels.some((l) => l.parentId === d.label.id);
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{d.label.name}"?</DialogTitle>
            <DialogDescription>The label is removed from all conversations. No email is deleted.</DialogDescription>
          </DialogHeader>
          {hasChildren ? (
            <div className="flex flex-col gap-2">
              <Label>Sub-labels</Label>
              <Select value={children} onValueChange={(v) => setChildren(v as "delete" | "reparent")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reparent">Keep them — move up one level</SelectItem>
                  <SelectItem value="delete">Delete them too</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={state.remove.isPending} onClick={() => state.remove.mutate({ id: d.label.id, children })}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isCreate = d.kind === "create";
  const submit = () => {
    if (!name.trim()) return;
    if (isCreate) {
      const accountId = d.parentId ? d.accountId : scope === "personal" ? null : scope;
      state.create.mutate({ name: name.trim(), parentId: d.parentId, accountId, color });
    } else {
      state.update.mutate({ id: d.label.id, patch: { name: name.trim() } });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setColor(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isCreate ? (d.parentId ? "New sub-label" : "New label") : "Rename label"}</DialogTitle>
          <DialogDescription>{isCreate ? "Labels are local to twodb and can be nested." : "Only the label name changes."}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input autoFocus placeholder={isCreate ? "Label name" : d.label.name} defaultValue={isCreate ? "" : d.label.name} onChange={(e) => setName(e.target.value)} />
          {isCreate && !d.parentId ? (
            <>
              <div className="flex gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    className={cn("size-6 rounded-sm border", color === c && "ring-ring ring-2")}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              {sharedAccounts.length ? (
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal — only me, any account</SelectItem>
                    {sharedAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        Shared with {a.address} members
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </>
          ) : null}
          {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={state.create.isPending || state.update.isPending}>
              {isCreate ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LabelTree({ labels, accounts, activeId, onSelect }: LabelTreeProps) {
  const state = useLabelTree(labels);
  return (
    <nav className="flex flex-col gap-0.5 border-t pt-2">
      <div
        className={cn("flex items-center justify-between rounded-md px-2 pb-1.5", state.dropTarget === "root" && state.canDrop("root") && "ring-primary ring-1")}
        onDragOver={(e) => {
          if (!state.canDrop("root")) return;
          e.preventDefault();
          state.setDropTarget("root");
        }}
        onDrop={(e) => {
          e.preventDefault();
          state.drop("root");
        }}
      >
        <span className="text-muted-foreground/70 text-[11px] font-semibold tracking-wider uppercase">Labels</span>
        <Button variant="ghost" size="icon-xs" aria-label="New label" onClick={() => state.setDialog({ kind: "create", parentId: null, accountId: null })}>
          <Plus />
        </Button>
      </div>
      {!labels.length ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-2 py-1 text-xs"
          onClick={() => state.setDialog({ kind: "create", parentId: null, accountId: null })}
        >
          <Tag size={12} /> Create your first label
        </button>
      ) : null}
      {state.tree.map((node) => (
        <LabelRow key={node.id} node={node} state={state} activeId={activeId} onSelect={onSelect} />
      ))}
      {state.error && !state.dialog ? <p className="text-destructive px-2 text-xs">{state.error}</p> : null}
      <LabelDialogs key={state.dialog ? JSON.stringify(state.dialog.kind) + ("label" in state.dialog ? state.dialog.label.id : "") : "none"} state={state} labels={labels} accounts={accounts} />
    </nav>
  );
}
