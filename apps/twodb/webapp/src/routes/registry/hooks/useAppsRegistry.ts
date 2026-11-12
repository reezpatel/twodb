import { useCallback, useEffect, useRef, useState } from "react";
import {
  gatewayClient,
  type RegisteredAppSummary,
  type AppStatus,
  type CatalogEntry,
} from "../../../lib/gateway-client.js";

/** Business hook: loads + refreshes the app list, merged with the static
 * install catalog (catalog entries not yet registered appear as
 * not-yet-installed cards in the same grid). */
export function useAppsRegistryData() {
  const [apps, setApps] = useState<RegisteredAppSummary[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [registered, catalogEntries] = await Promise.all([
      gatewayClient.listApps(),
      gatewayClient.listCatalog().catch(() => [] as CatalogEntry[]),
    ]);
    setApps(registered);
    setCatalog(catalogEntries);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { apps, catalog, loading, refresh };
}

/** Business hook: register an external (unmanaged) app. */
export function useAddExternalApp(onAdded: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (input: { slug: string; name: string; httpUrl: string; basePath?: string }) => {
      setBusy(true);
      setError(null);
      try {
        await gatewayClient.registerExternalApp(input);
        onAdded();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onAdded],
  );

  return { add, busy, error };
}

/**
 * Business hook: one app's live status + lifecycle actions
 * (install/start/stop/restart/upgrade/remove). Polls while a lifecycle
 * operation is in flight (`installing`), stops when settled.
 */
export function useAppLifecycle(slug: string) {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await gatewayClient.getAppStatus(slug);
      setStatus(s);
      return s;
    } catch {
      // Not-yet-registered catalog app (or control plane hiccup) — no status yet.
      setStatus(null);
      return null;
    }
  }, [slug]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const s = await refresh();
      if (!s || s.installStatus !== "installing") {
        stopPolling();
        setBusy(false);
      }
    }, 3000);
  }, [refresh, stopPolling]);

  useEffect(() => {
    refresh();
    return stopPolling;
  }, [refresh, stopPolling]);

  const act = useCallback(
    async (action: "install" | "start" | "stop" | "restart" | "upgrade") => {
      setBusy(true);
      try {
        await gatewayClient.lifecycle(slug, action);
        if (action === "install" || action === "upgrade" || action === "restart" || action === "start") {
          startPolling();
        } else {
          await refresh();
          setBusy(false);
        }
      } catch {
        setBusy(false);
      }
    },
    [slug, refresh, startPolling],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    await gatewayClient.removeApp(slug);
    await refresh();
    setBusy(false);
  }, [slug, refresh]);

  /** Rotates the token. Returns the new plaintext token for unmanaged apps (null for managed — their container is recreated). */
  const rotate = useCallback(async (): Promise<{ token: string; expiresAt: string | null } | null> => {
    setBusy(true);
    try {
      const r = await gatewayClient.rotateToken(slug);
      if (r.managed) {
        startPolling();
        return null;
      }
      setBusy(false);
      return { token: r.token ?? "", expiresAt: r.expiresAt ?? null };
    } catch (err) {
      setBusy(false);
      throw err;
    }
  }, [slug, startPolling]);

  return { status, busy, act, remove, rotate };
}
