import { useMemo, useState, type ReactNode } from "react";
import { navigate } from "../lib/router";
import { ScanContext, type ScanApi } from "./ScanContext";
import type { OverlayRequest } from "./hooks/useScanOverlay";
import { useWedgeScanner } from "./hooks/useWedgeScanner";
import { ScanOverlay } from "./ScanOverlay";

/**
 * Owns the single scanner overlay. Anywhere in the app: `useScanner().open()`
 * for a session, `await useScanner().pick({title})` to fill a field. When the
 * overlay is closed, a USB/Bluetooth scanner scan jumps to the code's page.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<OverlayRequest | null>(null);

  const api = useMemo<ScanApi>(
    () => ({
      open: (opts) => setReq({ kind: "session", ...opts }),
      pick: (opts) => new Promise<string | null>((resolve) => setReq({ kind: "pick", resolve, ...opts })),
    }),
    [],
  );

  useWedgeScanner((code) => navigate(`/c/${encodeURIComponent(code)}`), !req);

  return (
    <ScanContext.Provider value={api}>
      {children}
      {req && <ScanOverlay request={req} onClose={() => setReq(null)} />}
    </ScanContext.Provider>
  );
}
