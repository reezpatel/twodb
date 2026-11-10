import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  gatewayClient,
  type RegisteredAppSummary,
  type EndpointJson,
  type MessagesJson,
  type EndpointSpec,
} from "../../../lib/gateway-client.js";

/** Business hook: the app list (for the picker tabs). */
export function useExplorerApps() {
  const [apps, setApps] = useState<RegisteredAppSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gatewayClient
      .listApps()
      .then((result) => setApps(result))
      .finally(() => setLoading(false));
  }, []);

  return { apps, loading };
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
 * Holding hook for the GatewayExplorer component. The URL owns the app + tab:
 * /hub/:app/:tab — selecting an app or tab navigates; a missing/invalid
 * tab param falls back to "endpoints".
 */
export function useGatewayExplorer() {
  const { app: slugParam, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const selectedSlug = slugParam ?? null;
  const tab = tabParam === "messages" ? "messages" : "endpoints";

  const { apps, loading: appsLoading } = useExplorerApps();
  const { endpoints, messages, loading: contractLoading, error } = useAppContract(selectedSlug);
  const tryIt = useTryIt(selectedSlug);

  const setSelectedSlug = useCallback(
    (slug: string) => navigate(`/hub/${slug}/endpoints`),
    [navigate],
  );
  const setTab = useCallback(
    (next: string) => {
      if (selectedSlug && next !== tab) navigate(`/hub/${selectedSlug}/${next}`);
    },
    [navigate, selectedSlug, tab],
  );

  return {
    apps,
    appsLoading,
    selectedSlug,
    setSelectedSlug,
    tab,
    setTab,
    endpoints,
    messages,
    contractLoading,
    error,
    ...tryIt,
  };
}
