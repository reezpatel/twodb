import { useEffect, useState } from "react";

/** File walk for the composer's @ mentions — one fetch, cached 60s, filtered client-side. */

const cache = new Map<string, { at: number; files: string[] }>();
const TTL = 60_000;

export function useDirectoryFiles(sessionId: string | null): string[] {
  const [files, setFiles] = useState<string[]>(sessionId ? (cache.get(sessionId)?.files ?? []) : []);

  useEffect(() => {
    if (!sessionId) {
      setFiles([]);
      return;
    }
    const hit = cache.get(sessionId);
    if (hit && Date.now() - hit.at < TTL) {
      setFiles(hit.files);
      return;
    }
    let cancelled = false;
    fetch(`/artisan-api/sessions/${sessionId}/files`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files?: string[] }) => {
        const list = (d.files ?? []).filter((f) => !f.startsWith("."));
        cache.set(sessionId, { at: Date.now(), files: list });
        if (!cancelled) setFiles(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return files;
}

/** Fetches one file's content (for sending attachments). */
export async function fetchFileContent(sessionId: string, path: string): Promise<string> {
  const res = await fetch(`/artisan-api/sessions/${sessionId}/files/${encodeURI(path)}`, { credentials: "include" });
  if (!res.ok) return "";
  return ((await res.json()) as { content?: string }).content ?? "";
}

/** Attached files appended to the outgoing prompt as fenced path blocks. */
export async function buildAttachmentBlock(sessionId: string, paths: string[]): Promise<string> {
  if (paths.length === 0) return "";
  const parts = await Promise.all(paths.map(async (p) => `--- ${p} ---\n${(await fetchFileContent(sessionId, p)).slice(0, 20_000)}`));
  return `\n\n${parts.join("\n\n")}`;
}
