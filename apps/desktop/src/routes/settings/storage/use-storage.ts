import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export interface StorageBackend {
  id: string;
  name: string;
  type: "object" | "block";
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageTestResult {
  ok: boolean;
  error?: string;
}

export function useStorage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const backends = useQuery({
    queryKey: ["storage", "backends"],
    queryFn: () => api<StorageBackend[]>("/api/storage-backends"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["storage", "backends"] });

  const create = useMutation({
    mutationFn: (payload: { name: string; type: "object" | "block"; config: Record<string, string | boolean> }) =>
      api<StorageBackend>("/api/storage-backends", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api<StorageBackend>(`/api/storage-backends/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/storage-backends/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const test = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await api<StorageTestResult>(`/api/storage-backends/${id}/test`, { method: "POST", body: "{}" });
      } catch (e) {
        return { ok: false, error: (e as Error).message } as StorageTestResult;
      }
    },
  });

  const sync = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; files: number; folders: number }>(`/api/storage-backends/${id}/sync`, { method: "POST", body: "{}" }),
  });

  const onSaved = () => {
    setActionError(null);
    void invalidate();
  };

  const onDelete = async (backend: StorageBackend) => {
    setActionError(null);
    if (!window.confirm(`Delete backend "${backend.name}"? Files on the backend itself are not deleted.`)) return;
    try {
      await remove.mutateAsync(backend.id);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return { backends, create, update, remove, test, sync, actionError, setActionError, onSaved, onDelete };
}
