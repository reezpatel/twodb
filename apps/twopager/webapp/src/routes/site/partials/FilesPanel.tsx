import { useState } from "react";
import { Button, Input, Textarea } from "@twodb/blocks";
import type { FileContent, VersionDetail } from "../../../lib/types";
import { Section } from "../../../components/Ui";

interface Props {
  version: VersionDetail | undefined;
  isDraft: boolean;
  path: string | null;
  file: FileContent | undefined;
  text: string;
  onText: (t: string) => void;
  onOpen: (p: string | null) => void;
  onSave: (path: string, content: string) => void;
  onRemove: (path: string) => void;
  onDraftFrom: (id: string) => void;
}

export function FilesPanel({ version, isDraft, path, file, text, onText, onOpen, onSave, onRemove, onDraftFrom }: Props) {
  const [newPath, setNewPath] = useState("");
  if (!version) return <Section title="Files"><p className="text-sm text-ink-muted">Select a version first.</p></Section>;
  const binary = file?.encoding === "base64";
  return (
    <Section
      title={`Files — v${version.number} (${isDraft ? "draft" : "read-only"})`}
      actions={!isDraft ? <Button variant="secondary" onClick={() => onDraftFrom(version.id)}>Edit a copy</Button> : null}
    >
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div>
          <ul className="max-h-96 space-y-0.5 overflow-auto text-sm">
            {version.files.map((f) => (
              <li key={f.path}><button type="button" onClick={() => onOpen(f.path)} className={`w-full truncate rounded-sm px-2 py-1 text-left hover:bg-stone ${f.path === path ? "bg-stone font-medium" : ""}`}>{f.path}</button></li>
            ))}
            {!version.files.length ? <li className="text-ink-muted">Empty.</li> : null}
          </ul>
          {isDraft ? (
            <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); const p = newPath.trim().replace(/^\/+/, ""); if (p) { onSave(p, ""); onOpen(p); setNewPath(""); } }}>
              <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="new/page.html" aria-label="New file path" />
              <Button type="submit" variant="secondary">Add</Button>
            </form>
          ) : null}
        </div>
        <div>
          {!path ? <p className="text-sm text-ink-muted">Open a file to view{isDraft ? " or edit" : ""} it.</p> : !file ? <p className="text-sm text-ink-muted">Loading…</p> : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 text-sm"><code>{file.path}</code><span className="text-ink-muted">{file.contentType}</span></div>
              {binary ? <p className="text-sm text-ink-muted">Binary file ({file.size} bytes) — replace it by uploading a zip.</p> : (
                <Textarea className="h-80 font-mono text-xs" value={text} readOnly={!isDraft} onChange={(e) => onText(e.target.value)} aria-label="File content" />
              )}
              {isDraft ? (
                <div className="mt-2 flex gap-2">
                  {!binary ? <Button onClick={() => onSave(path, text)}>Save</Button> : null}
                  <Button variant="secondary" onClick={() => { if (confirm(`Delete ${path}?`)) onRemove(path); }}>Delete file</Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
