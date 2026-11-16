import { Button } from "@twodb/blocks";
import type { Version } from "../../../lib/types";
import { Section } from "../../../components/Ui";

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
  return (
    <Section title="Versions" actions={<Button variant="secondary" onClick={() => onDraftFrom(null)}>New empty draft</Button>}>
      {!versions.length ? <p className="text-sm text-ink-muted">No versions yet — upload a zip or start a draft.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-muted uppercase"><tr><th className="py-1">#</th><th>Status</th><th>Message</th><th>Files</th><th>Size</th><th>Created</th><th /></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className={`border-t border-outline ${v.id === selectedId ? "bg-stone/40" : ""}`}>
                <td className="py-2 font-medium"><button type="button" className="underline-offset-2 hover:underline" onClick={() => onSelect(v.id)}>v{v.number}</button></td>
                <td>{v.active ? <span className="rounded-sm bg-success/15 px-1.5 py-0.5 text-xs text-success">live</span> : <span className="text-ink-muted">{v.status === "draft" ? "draft" : "released"}</span>}</td>
                <td className="max-w-48 truncate text-ink-muted">{v.message ?? "—"}</td>
                <td>{v.fileCount}</td>
                <td>{size(v.totalBytes)}</td>
                <td className="text-ink-muted">{new Date(v.createdAt).toLocaleString()}</td>
                <td className="space-x-1 py-1 text-right whitespace-nowrap">
                  {v.status === "draft" ? <Button variant="secondary" disabled={!v.fileCount} onClick={() => onFinalize(v.id, true)}>Publish</Button> : null}
                  {v.status === "final" && !v.active ? <Button variant="secondary" onClick={() => onActivate(v.id)}>{v.number < (versions.find((x) => x.active)?.number ?? Infinity) ? "Roll back" : "Activate"}</Button> : null}
                  {v.status === "final" ? <Button variant="ghost" onClick={() => onDraftFrom(v.id)}>Edit copy</Button> : null}
                  {!v.active ? <Button variant="ghost" onClick={() => { if (confirm(`Delete v${v.number}?`)) onDelete(v.id); }}>Delete</Button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}
