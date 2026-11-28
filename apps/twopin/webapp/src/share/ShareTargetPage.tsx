import { Button } from "@twodb/blocks";
import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { navigate } from "../lib/router.js";
import { twopinClient } from "../lib/twopin-client.js";

/** Pulls the shared URL out of the share-target query string: ?url= wins,
 * otherwise the first https?:// URL found in ?text= / ?title=. */
function sharedUrl(): string | null {
  const q = new URLSearchParams(window.location.search);
  const direct = q.get("url")?.trim();
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  for (const key of ["text", "title"]) {
    const match = q.get(key)?.match(/https?:\/\/\S+/i);
    if (match) return match[0];
  }
  return null;
}

/**
 * Share-target landing page (real path /share, outside the hash router):
 * saves the shared URL to the default board, then closes the window (or
 * falls back to navigating to the boards view).
 */
export function ShareTargetPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invokes effects.
    started.current = true;

    const url = sharedUrl();
    if (!url) {
      setError("No URL was shared.");
      return;
    }

    twopinClient
      .shareSave({ url })
      .then(() => {
        setDone(true);
        window.close();
        // window.close() only works for script-opened windows; fall back to
        // in-app navigation if we're still here shortly after.
        window.setTimeout(() => navigate("/boards", { replace: true }), 900);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {error ? (
          <>
            <TriangleAlert className="size-10 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => navigate("/boards", { replace: true })}>Go to boards</Button>
          </>
        ) : done ? (
          <>
            <Check className="size-10 text-ion-deep" />
            <p className="text-sm font-semibold text-ink">Saved to your board</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">Saving…</p>
        )}
      </div>
    </div>
  );
}

