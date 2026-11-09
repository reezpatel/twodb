import { useCallback, useEffect, useState } from "react";
import { gatewayClient, type RegisteredAppSummary } from "../../../lib/gateway-client.js";

/** Business hook: loads + refreshes the registered-apps list, exposes provisioning. */
export function useAppsRegistryData() {
  const [apps, setApps] = useState<RegisteredAppSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await gatewayClient.listApps();
    setApps(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { apps, loading, refresh };
}

/** Business hook: provisioning a single app's Postgres schema+role, with per-row pending/result state. */
export function useProvisionApp() {
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; connectionString: string } | null>(null);

  const provision = useCallback(async (slug: string) => {
    setProvisioning(slug);
    try {
      const res = await gatewayClient.provisionApp(slug);
      setResult({ slug, connectionString: res.connectionString });
    } finally {
      setProvisioning(null);
    }
  }, []);

  return { provisioning, result, provision, dismissResult: () => setResult(null) };
}

/** Holding hook for the AppsRegistry component — composes the two business hooks above. */
export function useAppsRegistry() {
  const { apps, loading, refresh } = useAppsRegistryData();
  const { provisioning, result, provision, dismissResult } = useProvisionApp();

  const provisionAndRefresh = useCallback(
    async (slug: string) => {
      await provision(slug);
      await refresh();
    },
    [provision, refresh],
  );

  return { apps, loading, provisioning, result, provisionAndRefresh, dismissResult };
}
