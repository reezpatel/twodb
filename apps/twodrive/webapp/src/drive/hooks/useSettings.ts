import { useCallback, useEffect, useState } from "react";
import { driveClient, type AccessKeyDto, type AppOverrideDto, type BackendDto, type VirtualStorageDto } from "../../lib/drive-client.js";
import { useDrive } from "./useDrive.js";

/** Business hook: the current virtual storage's access keys (S3 API creds). */
export function useAccessKeys(storageId: string | null) {
  const [keys, setKeys] = useState<AccessKeyDto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storageId) return setKeys([]);
    setLoading(true);
    try {
      setKeys((await driveClient.listAccessKeys(storageId)).keys);
    } finally {
      setLoading(false);
    }
  }, [storageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (label?: string) => {
      if (!storageId) throw new Error("no storage selected");
      const created = await driveClient.createAccessKey(storageId, label);
      await refresh();
      return created;
    },
    [storageId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!storageId) return;
      await driveClient.deleteAccessKey(storageId, id);
      await refresh();
    },
    [storageId, refresh],
  );

  return { keys, loading, refresh, create, remove };
}

/** Business hook: app overrides (app identifier → virtual storage). */
export function useAppOverrides() {
  const [overrides, setOverrides] = useState<AppOverrideDto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOverrides((await driveClient.listAppOverrides()).overrides);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = useCallback(
    async (appId: string, virtualStorageId: string | null) => {
      await driveClient.setAppOverride(appId, virtualStorageId);
      await refresh();
    },
    [refresh],
  );

  return { overrides, loading, set, refresh };
}

/** Business hook: backend CRUD with test-before-create. */
export function useBackends() {
  const { refreshTree } = useDrive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (payload: { name: string; type: "s3" | "local"; config: Record<string, unknown> }) => {
      setBusy(true);
      setError(null);
      try {
        await driveClient.createBackend({ ...payload, test: true });
        await refreshTree();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshTree],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        await driveClient.deleteBackend(id);
        await refreshTree();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshTree],
  );

  const test = useCallback(async (id: string) => driveClient.testBackend(id), []);

  return { create, remove, test, busy, error };
}

/** Business hook: virtual storage CRUD + default selection. */
export function useStorages() {
  const { refreshTree } = useDrive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (payload: { name: string; backendId: string; setAsDefault?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        await driveClient.createStorage(payload);
        await refreshTree();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshTree],
  );

  const setDefault = useCallback(
    async (id: string | null) => {
      setBusy(true);
      try {
        await driveClient.setDefaultStorage(id);
        await refreshTree();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refreshTree],
  );

  const remove = useCallback(
    async (id: string, hardDelete: boolean) => {
      setBusy(true);
      setError(null);
      try {
        await driveClient.deleteStorage(id, { confirm: true, hardDelete });
        await refreshTree();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshTree],
  );

  return { create, setDefault, remove, busy, error };
}

export type { BackendDto, VirtualStorageDto };
