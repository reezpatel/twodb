import { Button } from "@twodb/blocks";
import type { Version } from "../../../lib/types";
import { Badge } from "../../../lib/badge";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table";

const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

interface Props {
  versions: Version[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onFinalize: (id: string, activate: boolean) => void;
  onDraftFrom: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function VersionsPanel({ versions, selectedId, onSelect, onActivate, onFinalize, onDraftFrom, onDelete }: Props) {
  const liveNumber = versions.find((x) => x.active)?.number ?? Infinity;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => onDraftFrom(null)}>New empty draft</Button></div>
      <TableCard>
        {!versions.length ? <TableEmpty>No versions yet — upload a zip or start a draft.</TableEmpty> : (
          <DataTable columns={["Version", "Status", { label: "Message", mobile: false }, { label: "Files", mobile: false }, { label: "Size", mobile: false }, { label: "Created", mobile: false }, ""]} minWidth={0}>
            {versions.map((v) => (
              <Tr key={v.id} onClick={() => onSelect(v.id)} className={v.id === selectedId ? "bg-stone/50" : ""}>
                <Td className="font-medium text-ink">v{v.number}</Td>
                <Td>{v.active ? <Badge tone="success">live</Badge> : <Badge tone={v.status === "draft" ? "warning" : "neutral"}>{v.status === "draft" ? "draft" : "released"}</Badge>}</Td>
                <Td hideOnMobile className="max-w-48 truncate text-ink-muted">{v.message ?? "—"}</Td>
                <Td hideOnMobile>{v.fileCount}</Td>
                <Td hideOnMobile>{size(v.totalBytes)}</Td>
                <Td hideOnMobile className="text-ink-muted">{new Date(v.createdAt).toLocaleString()}</Td>
                <Td className="text-right">
                  <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {v.status === "draft" ? <Button size="sm" variant="secondary" disabled={!v.fileCount} onClick={() => onFinalize(v.id, true)}>Publish</Button> : null}
                    {v.status === "final" && !v.active ? <Button size="sm" variant="secondary" onClick={() => onActivate(v.id)}>{v.number < liveNumber ? "Roll back" : "Activate"}</Button> : null}
                    {v.status === "final" ? <Button size="sm" variant="ghost" onClick={() => onDraftFrom(v.id)}>Edit copy</Button> : null}
                    {!v.active ? <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete v${v.number}?`)) onDelete(v.id); }}>Delete</Button> : null}
                  </span>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </TableCard>
    </div>
  );
}
