import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/artisan-client.js";

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
    apiFetch(`/sessions/${sessionId}/files`)
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
  const res = await apiFetch(`/sessions/${sessionId}/files/${encodeURI(path)}`);
  if (!res.ok) return "";
  return ((await res.json()) as { content?: string }).content ?? "";
}

/** Attached files appended to the outgoing prompt as fenced path blocks. */
export async function buildAttachmentBlock(sessionId: string, paths: string[]): Promise<string> {
  if (paths.length === 0) return "";
  const parts = await Promise.all(paths.map(async (p) => `--- ${p} ---\n${(await fetchFileContent(sessionId, p)).slice(0, 20_000)}`));
  return `\n\n${parts.join("\n\n")}`;
}

/** Skills for the `/` slash palette — fetched once per session. */
const skillCache = new Map<string, { at: number; skills: Array<{ id: string; name: string; description: string; content: string }> }>();

export function useSkills(spaceId?: string): Array<{ id: string; name: string; description: string; content: string }> {
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string; content: string }>>(spaceId ? (skillCache.get(spaceId)?.skills ?? []) : []);

  useEffect(() => {
    if (!spaceId) {
      setSkills([]);
      return;
    }
    const hit = skillCache.get(spaceId);
    if (hit && Date.now() - hit.at < TTL) {
      setSkills(hit.skills);
      return;
    }
    let cancelled = false;
    apiFetch(`/skills?spaceId=${encodeURIComponent(spaceId)}&content=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ id: string; name: string; description: string; content: string }>) => {
        skillCache.set(spaceId, { at: Date.now(), skills: list });
        if (!cancelled) setSkills(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  return skills;
}

/** Upload a File to the shared scratch dir on the (online) runner via the
 *  session console endpoint. Returns the absolute path. */
export async function uploadAttachment(sessionId: string, file: File): Promise<string> {
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const target = `/tmp/artisan-uploads/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  // Write via printf (base64 -d <<< adds a trailing newline); wrap b64 at 200 chars.
  const b64w = b64.replace(/(.{200})/g, "$1\\n");
  const cmd = [
    "mkdir -p /tmp/artisan-uploads",
    `printf '%s' '${b64w}' | base64 -d > '${target.replace(/'/g, "'\\''")}'`,
    `echo '${target.replace(/'/g, "'\\''")}'`,
  ].join(" && ");
  const res = await apiFetch(`/sessions/${sessionId}/console`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: cmd }),
  });
  if (!res.ok) throw new Error("upload failed");
  const body = (await res.json()) as { stdout?: string };
  return body.stdout?.trim() || target;
}

/** Build the attachment block for the outgoing prompt. `items` are either
 *  relative session paths or absolute uploaded paths (read via /files/read). */
export async function buildAttachmentBlock2(
  sessionId: string,
  items: Array<{ path: string; uploaded?: boolean }>,
): Promise<string> {
  if (items.length === 0) return "";
  const parts = await Promise.all(
    items.map(async (it) => {
      const content = it.uploaded
        ? await apiFetch(`/files/read?path=${encodeURIComponent(it.path)}`)
            .then((r) => (r.ok ? r.json() : { content: "" }))
            .then((d: { content?: string }) => d.content ?? "")
            .catch(() => "")
        : await fetchFileContent(sessionId, it.path);
      return `--- ${it.uploaded ? it.path.split("/").pop() : it.path} ---\n${(content ?? "").slice(0, 20_000)}`;
    }),
  );
  return `\n\n${parts.join("\n\n")}`;
}
