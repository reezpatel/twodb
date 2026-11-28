import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { gatewayClient, type S3Info, type S3ListResult } from "../../../lib/gateway-client.js";

export interface StorageState {
  info: S3Info | null;
  listing: S3ListResult | null;
  prefix: string;
  loading: boolean;
  error: string | null;
  /** Key pending delete confirmation (two-click pattern, like key revoke). */
  confirmingKey: string | null;
  busy: boolean;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  openPrefix: (prefix: string) => void;
  up: () => void;
  refresh: () => void;
  startDelete: (key: string) => void;
  cancelDelete: () => void;
  confirmDelete: (key: string) => Promise<void>;
  upload: (files: FileList | null) => Promise<void>;
  download: (key: string) => void;
}

/** Business hook for the storage explorer: bucket info + one-level listing, URL-driven prefix (?prefix=). */
export function useStorage(): StorageState {
  const [params, setParams] = useSearchParams();
  const prefix = params.get("prefix")?.replace(/^\/+|\/+$/g, "") ?? "";
  const [info, setInfo] = useState<S3Info | null>(null);
  const [listing, setListing] = useState<S3ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const [i, l] = await Promise.all([gatewayClient.s3Info(), gatewayClient.s3List(p)]);
      setInfo(i);
      setListing(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(prefix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  const openPrefix = useCallback(
    (p: string) => {
      setConfirmingKey(null);
      setParams(p ? { prefix: p } : {});
    },
    [setParams],
  );

  const up = useCallback(() => {
    const parent = prefix.split("/").slice(0, -1).join("/");
    openPrefix(parent);
  }, [prefix, openPrefix]);

  const refresh = useCallback(() => void load(prefix), [load, prefix]);

  const confirmDelete = useCallback(
    async (key: string) => {
      setBusy(true);
      setError(null);
      try {
        await gatewayClient.s3Delete(key);
        setConfirmingKey(null);
        await load(prefix);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [load, prefix],
  );

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          await gatewayClient.s3Upload(prefix, file);
        }
        await load(prefix);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [load, prefix],
  );

  const download = useCallback((key: string) => {
    // Plain navigation — the endpoint streams the object with the session cookie.
    window.location.assign(`/registry/s3/object?key=${encodeURIComponent(key)}`);
  }, []);

  return {
    info,
    listing,
    prefix,
    loading,
    error,
    confirmingKey,
    busy,
    uploadInputRef,
    openPrefix,
    up,
    refresh,
    startDelete: setConfirmingKey,
    cancelDelete: () => setConfirmingKey(null),
    confirmDelete,
    upload,
    download,
  };
}

