import { useEffect } from "react";
import { ScanLine } from "lucide-react";
import { adjustItem } from "../lib/actions";
import { api } from "../lib/api";
import { displayCode } from "../lib/format";
import { useQuery } from "../lib/query";
import { navigate } from "../lib/router";
import { useScanner } from "../scanner/ScanContext";
import { MatchCard, NoMatchCard, type MatchHandlers } from "../ui/MatchCard";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";

/**
 * /c/:code — where printed deep-link QRs and USB-scanner scans land. A single
 * item/place match redirects straight to it; otherwise show the options.
 */
export function ResolvePage({ code }: { code: string }) {
  const { data, loading } = useQuery(`resolve:${code}`, () => api.resolve(code));
  const scanner = useScanner();

  useEffect(() => {
    if (!data || data.matches.length !== 1) return;
    const m = data.matches[0];
    if (m.type === "item") navigate(`/items/${m.item.id}`, { replace: true });
    if (m.type === "location") navigate(`/places/${m.location.id}`, { replace: true });
  }, [data]);

  const h: MatchHandlers = {
    onOpenItem: (it) => navigate(`/items/${it.id}`),
    onOpenPlace: (p) => navigate(`/places/${p.id}`),
    onDelta: (it, d) => void adjustItem(it, d),
    onNewItem: ({ code: c, barcode }) => navigate(`/items/new?${new URLSearchParams({ ...(c ? { code: c } : {}), ...(barcode ? { barcode } : {}) })}`),
    onNewPlace: ({ code: c }) => navigate(`/places/new?code=${c}`),
  };

  return (
    <Page className="max-w-2xl">
      <PageHeader title={<span className="font-mono tracking-wider">{displayCode(code)}</span>} subtitle="Scanned code" onBack />
      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {data.matches.length ? data.matches.map((m, i) => <MatchCard key={i} match={m} h={h} />) : <NoMatchCard raw={code} onNewItem={() => h.onNewItem({ barcode: code })} onSearch={() => navigate(`/items?q=${encodeURIComponent(code)}`)} />}
          <button className={btn.secondary} onClick={() => scanner.open()}>
            <ScanLine className="size-4" /> Scan another
          </button>
        </div>
      )}
    </Page>
  );
}
