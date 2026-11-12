import { useState } from "react";
import { Download, FileUp, Keyboard, Volume2 } from "lucide-react";
import { refreshAll } from "../lib/actions";
import { api, errorMessage } from "../lib/api";
import { toast } from "../lib/toast";
import { Card } from "../ui/Field";
import { Page, PageHeader, btn } from "../ui/Page";

type ImportResult = Awaited<ReturnType<typeof api.importCsv>>;

/** Import & export + small preferences. */
export function SettingsPage() {
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(localStorage.getItem("twothing.sound") !== "off");

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setCsv({ name: f.name, text });
    setBusy(true);
    try {
      setPreview(await api.importCsv(text, true));
    } catch (e) {
      toast(errorMessage(e), { tone: "error" });
      setCsv(null);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!csv) return;
    setBusy(true);
    try {
      const res = await api.importCsv(csv.text, false);
      refreshAll();
      toast(`Imported ${res.created} items${res.errors.length ? `, ${res.errors.length} skipped` : ""}`, { tone: "success" });
      setCsv(null);
      setPreview(null);
    } catch (e) {
      toast(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="max-w-3xl">
      <PageHeader title="Import & export" />
      <div className="space-y-4">
        <Card title="Export">
          <p className="text-sm text-ink-muted">Every item as CSV — opens in any spreadsheet. Locations are written as “Room &gt; Shelf &gt; Box”.</p>
          <a href={api.exportUrl()} className={btn.secondary}>
            <Download className="size-4" /> Download CSV
          </a>
        </Card>

        <Card title="Import">
          <p className="text-sm text-ink-muted">
            CSV with a header row. Recognised columns: <i>Name</i> (required), Label, Category, Quantity, Unit, Min stock, Location (“A &gt; B &gt; C”, created if missing), Tags, Barcodes, Part number,
            Manufacturer, Supplier, Unit cost, Purchase URL, Datasheet URL, Description, Notes, Specs (“k=v; k=v”). The export file re-imports cleanly.
          </p>
          <label className={btn.secondary + " cursor-pointer"}>
            <FileUp className="size-4" /> {csv ? csv.name : "Choose CSV…"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {preview && (
            <div className="space-y-2 rounded-xl border border-outline bg-paper p-3 text-sm">
              <div>
                Ready to import <b>{preview.created}</b> item{preview.created === 1 ? "" : "s"}.
              </div>
              <div className="text-xs text-ink-muted">Columns: {preview.columns.map((c) => c ?? "—").join(", ")}</div>
              {preview.errors.length > 0 && (
                <ul className="max-h-32 overflow-y-auto text-xs text-destructive">
                  {preview.errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              )}
              <button className={btn.primary} disabled={busy || !preview.created} onClick={() => void run()}>
                Import {preview.created} items
              </button>
            </div>
          )}
        </Card>

        <Card title="Preferences">
          <label className="flex items-center gap-3 text-sm">
            <Volume2 className="size-4 text-ink-muted" />
            <span className="flex-1">Beep on scan</span>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                localStorage.setItem("twothing.sound", e.target.checked ? "on" : "off");
              }}
              className="accent-[var(--ink)]"
            />
          </label>
        </Card>

        <Card title="Keyboard">
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {[
              ["S", "Open scanner"],
              ["N", "Add item"],
              ["/  or  ⌘K", "Search"],
              ["Esc", "Close scanner"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <kbd className="rounded-md border border-outline bg-paper px-2 py-0.5 text-center font-mono text-xs">{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Keyboard className="size-3.5" /> USB / Bluetooth barcode scanners work anywhere — scan and TwoThing jumps to the result.
          </p>
        </Card>
      </div>
    </Page>
  );
}
