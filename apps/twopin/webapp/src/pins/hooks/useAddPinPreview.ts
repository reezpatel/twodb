import { useEffect, useRef, useState } from "react";
import { twopinClient, type MetadataPreview } from "../../lib/twopin-client.js";

const URLISH = /^[^\s]+\.[^\s]{2,}/;

export interface PreviewState {
  status: "idle" | "loading" | "ok" | "error";
  preview: MetadataPreview | null;
  error: string | null;
}

/** Business hook: debounced live metadata preview for the add-pin dialog. */
export function useAddPinPreview(url: string, debounceMs = 600): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "idle", preview: null, error: null });
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = url.trim();
    if (!URLISH.test(trimmed)) {
      setState({ status: "idle", preview: null, error: null });
      return;
    }
    const mySeq = ++seq.current;
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    const timer = setTimeout(async () => {
      try {
        const preview = await twopinClient.previewMetadata(trimmed);
        if (seq.current === mySeq) setState({ status: "ok", preview, error: null });
      } catch (err) {
        if (seq.current === mySeq) setState({ status: "error", preview: null, error: (err as Error).message });
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [url, debounceMs]);

  return state;
}
