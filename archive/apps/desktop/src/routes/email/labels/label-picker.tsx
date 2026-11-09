import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { emailKeys, type EmailLabel, type EmailThread } from "../email-api";
import { labelPathName } from "./use-label-tree";

interface LabelPickerProps {
  labels: EmailLabel[];
  threads: Pick<EmailThread, "id" | "accountId" | "labelIds">[];
  onApply: (add: string[], remove: string[]) => void;
  children: ReactNode;
}

/** Searchable label tree with tri-state checkboxes across the selected threads. */
export function LabelPicker({ labels, threads, onApply, children }: LabelPickerProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const accountIds = new Set(threads.map((t) => t.accountId));
  const usable = labels.filter((l) => !l.accountId || (accountIds.size === 1 && accountIds.has(l.accountId)));
  const ordered = useMemo(() => {
    const byParent = new Map<string | null, EmailLabel[]>();
    for (const l of usable) byParent.set(l.parentId, [...(byParent.get(l.parentId) ?? []), l]);
    const out: EmailLabel[] = [];
    const walk = (parent: string | null) => {
      for (const l of (byParent.get(parent) ?? []).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))) {
        out.push(l);
        walk(l.id);
      }
    };
    walk(null);
    return out;
  }, [usable]);
  const term = search.trim().toLowerCase();
  const visible = term ? ordered.filter((l) => labelPathName(labels, l.id).toLowerCase().includes(term)) : ordered;

  const create = useMutation({
    mutationFn: (name: string) => api<{ id: string }>("/api/email/labels", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.labels });
      onApply([id], []);
      setSearch("");
    },
  });

  const stateOf = (id: string): boolean | "indeterminate" => {
    const n = threads.filter((t) => t.labelIds.includes(id)).length;
    return n === 0 ? false : n === threads.length ? true : "indeterminate";
  };

  return (
    <Popover onOpenChange={(o) => !o && setSearch("")}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <Input autoFocus placeholder="Search or create label…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 h-8 text-xs" />
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {visible.map((l) => {
            const state = stateOf(l.id);
            return (
              <label
                key={l.id}
                className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm"
                style={{ paddingLeft: term ? 6 : 6 + l.depth * 14 }}
              >
                <Checkbox checked={state} onCheckedChange={() => (state === true ? onApply([], [l.id]) : onApply([l.id], []))} />
                <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: l.effectiveColor ?? "var(--color-muted-foreground)" }} />
                <span className="truncate">{term ? labelPathName(labels, l.id) : l.name}</span>
              </label>
            );
          })}
          {term && !visible.some((l) => l.name.toLowerCase() === term) ? (
            <button
              type="button"
              className="hover:bg-accent/50 text-muted-foreground flex items-center gap-2 rounded px-1.5 py-1 text-left text-sm"
              disabled={create.isPending}
              onClick={() => create.mutate(search.trim())}
            >
              <Plus size={13} /> Create "{search.trim()}"
            </button>
          ) : null}
          {!visible.length && !term ? <p className="text-muted-foreground px-1.5 py-2 text-sm">No labels yet.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
