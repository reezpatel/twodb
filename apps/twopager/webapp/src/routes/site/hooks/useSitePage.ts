import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { del, post, put, qs, uploadZip } from "../../../lib/api";
import { useApiMutation, useFile, useSite, useVersion, useVersions } from "../../../lib/queries";
import type { Version } from "../../../lib/types";
import { errMsg } from "../../../components/Ui";

export type Tab = "versions" | "files" | "domains" | "config";

/** Holding hook for SitePage: site, versions, the selected version's files/config and every action. */
export function useSitePage(siteId: string, spaceId: string) {
  const nav = useNavigate();
  const site = useSite(siteId);
  const versions = useVersions(siteId);
  const [tab, setTab] = useState<Tab>("versions");
  const [picked, setPicked] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState("");

  const list = versions.data ?? [];
  const versionId = picked ?? site.data?.activeVersionId ?? list[0]?.id ?? null;
  const version = useVersion(siteId, versionId);
  const file = useFile(siteId, versionId, path);
  const isDraft = version.data?.status === "draft";

  // editor buffer follows the opened file
  const [text, setText] = useState("");
  useEffect(() => { if (file.data) setText(file.data.encoding === "utf8" ? file.data.content : ""); }, [file.data]);
  useEffect(() => { setPath(null); }, [versionId]);

  const run = <V,>(fn: (v: V) => Promise<unknown>, after?: (r: any) => void) =>
    useApiMutation(fn, (r) => { setError(""); after?.(r); });
  const fail = { onError: (e: unknown) => setError(errMsg(e)) };

  const activate = run((id: string) => post(`/sites/${siteId}/activate`, { versionId: id }));
  const finalize = run((v: { id: string; activate: boolean }) => post(`/sites/${siteId}/versions/${v.id}/finalize`, { activate: v.activate }));
  const draftFrom = run((from: string | null) => post<Version>(`/sites/${siteId}/versions`, { ...(from ? { fromVersionId: from } : {}), message: from ? "edit" : "new draft" }), (v: Version) => { setPicked(v.id); setTab("files"); });
  const removeVersion = run((id: string) => del(`/sites/${siteId}/versions/${id}`), () => setPicked(null));
  const upload = run((f: File) => uploadZip(siteId, f, { message: `zip: ${f.name}` }), (v: Version) => { setPicked(v.id); });
  const saveFile = run((v: { path: string; content: string }) => put(`/sites/${siteId}/versions/${versionId}/files`, { files: [{ path: v.path, content: v.content }] }), (_r) => undefined);
  const removeFile = run((p: string) => del(`/sites/${siteId}/versions/${versionId}/files${qs({ path: p })}`), () => setPath(null));
  const saveConfig = run((config: unknown) => put(`/sites/${siteId}/versions/${versionId}/config`, { config }));
  const addDomain = run((host: string) => post(`/sites/${siteId}/domains`, { host }));
  const removeDomain = run((host: string) => del(`/sites/${siteId}/domains/${encodeURIComponent(host)}`));
  const removeSite = run(() => del(`/sites/${siteId}`), () => nav(`/s/${spaceId}`));

  return {
    site: site.data,
    isLoading: site.isLoading || versions.isLoading,
    versions: list,
    version: version.data,
    isDraft,
    tab, setTab,
    selectVersion: setPicked,
    path, setPath, file: file.data, text, setText,
    error: error || (site.error ? errMsg(site.error) : ""),
    clearError: () => setError(""),
    actions: {
      activate: (id: string) => activate.mutate(id, fail),
      finalize: (id: string, go: boolean) => finalize.mutate({ id, activate: go }, fail),
      draftFrom: (from: string | null) => draftFrom.mutate(from, fail),
      removeVersion: (id: string) => removeVersion.mutate(id, fail),
      upload: (f: File) => upload.mutate(f, fail),
      uploading: upload.isPending,
      saveFile: (p: string, content: string) => saveFile.mutate({ path: p, content }, fail),
      removeFile: (p: string) => removeFile.mutate(p, fail),
      saveConfig: (c: unknown) => saveConfig.mutate(c, fail),
      addDomain: (h: string) => addDomain.mutate(h, fail),
      removeDomain: (h: string) => removeDomain.mutate(h, fail),
      removeSite: () => removeSite.mutate(undefined, fail),
    },
  };
}
