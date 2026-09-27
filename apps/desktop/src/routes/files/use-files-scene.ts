import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface StorageBackendInfo {
  id: string;
  name: string;
  type: "object" | "block";
}

export interface StorageBucketInfo {
  id: string;
  name: string;
  backendId: string;
  backendName: string;
  backendType: "object" | "block";
  storageLimit: number | null;
  used: number;
}

export interface StorageEntryInfo {
  id: string;
  path: string;
  type: "file" | "folder";
  size: number;
  mimeType: string | null;
  previewType: string | null;
  updatedAt: string;
}

/** Puts a file at bucket/<path>/<name> over the storage API. */
async function uploadFile(bucketId: string, dir: string, file: File) {
  const rel = `${dir ? `${dir}/` : ""}${file.name}`;
  const res = await fetch(`/api/storage/buckets/${bucketId}/raw/${rel}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": file.type || "application/octet-stream", origin: location.origin },
    body: await file.arrayBuffer(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `upload failed (${res.status})`);
  }
}

export function useFilesScene() {
  const queryClient = useQueryClient();
  const [bucket, setBucket] = useState<string | null>(null);
  const [path, setPath] = useState("");

  const backends = useQuery({
    queryKey: ["storage", "backends", "enabled"],
    queryFn: () => api<StorageBackendInfo[]>("/api/storage/backends"),
  });

  const buckets = useQuery({
    queryKey: ["storage", "buckets"],
    queryFn: () => api<StorageBucketInfo[]>("/api/storage/buckets"),
  });

  const bucketInfo = buckets.data?.find((b) => b.id === bucket) ?? null;

  const entries = useQuery({
    queryKey: ["storage", "entries", bucket, path],
    queryFn: () => api<StorageEntryInfo[]>(`/api/storage/buckets/${bucket}/list?path=${encodeURIComponent(path)}`),
    enabled: !!bucket,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["storage", "entries", bucket, path] });
    void queryClient.invalidateQueries({ queryKey: ["storage", "buckets"] });
  };

  const createBucket = useMutation({
    mutationFn: (input: { name: string; backendId: string; storageLimit?: number | null }) =>
      api<StorageBucketInfo>("/api/storage/buckets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["storage", "buckets"] }),
  });

  const upload = useMutation({
    mutationFn: ({ dir, files }: { dir: string; files: File[] }) => Promise.all(files.map((file) => uploadFile(bucket!, dir, file))),
    onSuccess: invalidate,
  });

  const mkdir = useMutation({
    mutationFn: (name: string) =>
      api(`/api/storage/buckets/${bucket}/folder`, { method: "POST", body: JSON.stringify({ path: `${path ? `${path}/` : ""}${name}` }) }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (entry: StorageEntryInfo) =>
      fetch(`/api/storage/buckets/${bucket}/raw/${entry.path}`, {
        method: "DELETE",
        credentials: "include",
        headers: { origin: location.origin },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`delete failed (${res.status})`);
      }),
    onSuccess: invalidate,
  });

  const openBucket = (id: string) => {
    setBucket(id);
    setPath("");
  };

  const openFolder = (folderPath: string) => setPath(folderPath);
  const navigateTo = (index: number) => {
    const segments = path ? path.split("/") : [];
    setPath(segments.slice(0, index + 1).join("/"));
  };

  return {
    backends,
    buckets,
    bucket,
    bucketInfo,
    path,
    entries,
    createBucket,
    upload,
    mkdir,
    remove,
    openBucket,
    openFolder,
    navigateTo,
  };
}
