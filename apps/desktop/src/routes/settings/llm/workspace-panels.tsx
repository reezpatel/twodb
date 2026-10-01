import type { ReactNode } from "react";
import { Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PanelShell({ title, hint, onNew, children }: { title: string; hint: string; onNew: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus size={13} /> New
        </Button>
      </div>
      {children}
    </div>
  );
}

export function Empty({ pending, label }: { pending: boolean; label: string }) {
  return <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-xs">{pending ? "Loading…" : `No ${label} yet.`}</p>;
}

function ScopeBadge({ codeDirectoryId }: { codeDirectoryId: string | null }) {
  if (!codeDirectoryId) return null;
  return (
    <Badge variant="secondary" className="text-[10px]">
      directory
    </Badge>
  );
}

export interface ResourceRow {
  id: string;
  name: ReactNode;
  subtitle?: ReactNode;
  tags: string[];
  codeDirectoryId: string | null;
}

/** Name + Tags table; hovering a name reveals a menu with edit/delete. */
export function ResourceTable({
  rows,
  onEdit,
  onDelete,
  deletePending,
}: {
  rows: ResourceRow[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  deletePending: boolean;
}) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-3.5">Name</TableHead>
            <TableHead className="pr-3.5">Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="group cursor-pointer" onClick={() => onEdit(row.id)}>
              <TableCell className="max-w-0 pl-3.5">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{row.name}</span>
                      <ScopeBadge codeDirectoryId={row.codeDirectoryId} />
                    </div>
                    {row.subtitle && <p className="text-muted-foreground truncate text-xs">{row.subtitle}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Actions"
                        aria-label="Row actions"
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Ellipsis size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(row.id);
                        }}
                      >
                        <Pencil size={13} /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletePending}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row.id);
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
              <TableCell className="pr-3.5">
                <div className="flex max-w-64 flex-wrap gap-1">
                  {row.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                  {row.tags.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
