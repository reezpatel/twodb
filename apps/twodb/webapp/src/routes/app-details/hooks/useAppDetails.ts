import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  gatewayClient,
  catalogEntryToSummary,
  type CatalogEntry,
  type RegisteredAppSummary,
  type EndpointJson,
  type MessagesJson,
  type EndpointSpec,
} from "../../../lib/gateway-client.js";

/** Business hook: the one app this page is about (name, route, state) — from the registry list or the install catalog. */
export function useAppSummary(slug: string | null) {
  const [app, setApp] = useState<RegisteredAppSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([gatewayClient.listApps(), gatewayClient.listCatalog().catch(() => [] as CatalogEntry[])])
      .then(([apps, catalog]) => {
        if (cancelled) return;
        const found = apps.find((a) => a.slug === slug);
        const entry = catalog.find((c) => c.slug === slug);
        setApp(found ?? (entry ? catalogEntryToSummary(entry) : null));
      })
      .catch(() => !cancelled && setApp(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { app, loading };
}

/** Business hook: loads one app's endpoint.json + messages.json contracts. */
export function useAppContract(slug: string | null) {
  const [endpoints, setEndpoints] = useState<EndpointJson | null>(null);
  const [messages, setMessages] = useState<MessagesJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setEndpoints(null);
    setMessages(null);
    Promise.allSettled([gatewayClient.getEndpointJson(slug), gatewayClient.getMessagesJson(slug)]).then(
      ([ep, msg]) => {
        if (ep.status === "fulfilled") setEndpoints(ep.value);
        else setError("app hasn't registered its endpoint contract yet (not installed/running?)");
        if (msg.status === "fulfilled") setMessages(msg.value);
        setLoading(false);
      },
    );
  }, [slug]);

  return { endpoints, messages, loading, error };
}

/** Business hook: which endpoint is selected + the try-it request/response state. */
export function useTryIt(slug: string | null) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointSpec | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string } | null>(null);

  const select = useCallback((ep: EndpointSpec | null) => {
    setSelectedEndpoint(ep);
    setResult(null);
    // Pre-fill: declared path as-is (params like :id stay for the user to
    // edit), and a body skeleton derived from the JSON-Schema properties.
    setPathInput(ep?.path ?? "");
    const schema = ep?.request as { properties?: Record<string, unknown> } | undefined;
    if (schema?.properties && ep?.method !== "GET") {
      const skeleton = Object.fromEntries(
        Object.entries(schema.properties)
          .filter(([key]) => key !== "slug" && key !== "id") // path params, not body
          .map(([key, value]) => [key, (value as { type?: string }).type === "string" ? "" : null]),
      );
      setBodyInput(Object.keys(skeleton).length ? JSON.stringify(skeleton, null, 2) : "");
    } else {
      setBodyInput("");
    }
  }, []);

  const send = useCallback(async () => {
    if (!slug || !selectedEndpoint) return;
    setSending(true);
    setResult(null);
    try {
      const res = await gatewayClient.tryEndpoint(slug, selectedEndpoint.method, pathInput, bodyInput || undefined);
      let pretty = res.body;
      try {
        pretty = JSON.stringify(JSON.parse(res.body), null, 2);
      } catch {
        // not JSON (e.g. a streamed SSE response) — show raw
      }
      setResult({ status: res.status, body: pretty });
    } catch (err) {
      setResult({ status: 0, body: String(err) });
    } finally {
      setSending(false);
    }
  }, [slug, selectedEndpoint, pathInput, bodyInput]);

  return { selectedEndpoint, select, pathInput, setPathInput, bodyInput, setBodyInput, sending, result, send };
}

/**
 * Holding hook for the AppDetails page. The URL owns the app + tab:
 * /app/:slug/:tab — a missing/invalid tab falls back to "endpoints".
 * (Not /apps/:slug — that prefix is the gateway's app proxy.)
 */
export function useAppDetails() {
  const { slug: slugParam, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const slug = slugParam ?? null;
  const tab = tabParam === "messages" ? "messages" : "endpoints";

  const { app, loading: appLoading } = useAppSummary(slug);
  const { endpoints, messages, loading: contractLoading, error } = useAppContract(slug);
  const tryIt = useTryIt(slug);

  const setTab = useCallback(
    (next: string) => {
      if (slug && next !== tab) navigate(`/app/${slug}/${next}`, { replace: true });
    },
    [navigate, slug, tab],
  );

  return { slug, app, appLoading, tab, setTab, endpoints, messages, contractLoading, error, ...tryIt };
}
