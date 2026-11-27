import { useState } from "react";
import { Download, FileUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@twodb/blocks";
import { refreshAll } from "../lib/actions";
import { api, errorMessage } from "../lib/api";
import { toast } from "../lib/toast";
import { Page, PageHeader, btn } from "../ui/Page";
import { Switch } from "../ui/Switch";

const ctl =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-ink/20 bg-transparent px-3 text-[12px] font-medium transition hover:bg-stone active:scale-[0.98] disabled:opacity-40";

/** A titled group: small heading above a bordered card of rows. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{title}</h2>
      <div className="divide-y divide-outline overflow-hidden rounded-[6px] border border-outline bg-card">{children}</div>
    </section>
  );
}

/** Label + description on the left, control on the right; `children` renders full-width below. */
function Row({ label, hint, control, children }: { label: string; hint?: ReactNode; control?: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">{label}</div>
          {hint && <div className="mt-0.5 text-[12px] font-light text-ink-muted">{hint}</div>}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

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
    <Page>
      <PageHeader title="Import & export" />
      <div className="mx-auto max-w-3xl space-y-6">
        <Group title="Data">
          <Row
            label="Export items"
            hint="Every item as CSV, opens in any spreadsheet. Locations are written as “Room > Shelf > Box”."
            control={
              <a href={api.exportUrl()} className={ctl}>
                <Download className="size-3.5" /> Download CSV
              </a>
            }
          />
          <Row
            label="Import items"
            hint="CSV with a header row. The export file re-imports cleanly."
            control={
              <label className={cn(ctl, "cursor-pointer")}>
                <FileUp className="size-3.5" /> {csv ? csv.name : "Choose CSV…"}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
              </label>
            }
          >
            <details className="mt-2 text-[12px] font-light text-ink-muted">
              <summary className="cursor-pointer select-none hover:text-ink">Recognised columns</summary>
              <p className="mt-1.5 leading-relaxed">
                <i>Name</i> (required), Label, Category, Quantity, Unit, Min stock, Location (“A &gt; B &gt; C”, created if missing), Tags, Barcodes, Part
                number, Manufacturer, Supplier, Unit cost, Purchase URL, Datasheet URL, Description, Notes, Specs (“k=v; k=v”).
              </p>
            </details>
            {preview && (
              <div className="mt-3 space-y-2 rounded-[6px] border border-outline bg-paper p-3 text-[13px]">
                <div>
                  Ready to import <b>{preview.created}</b> item{preview.created === 1 ? "" : "s"}.
                </div>
                <div className="text-[12px] text-ink-muted">Columns: {preview.columns.map((c) => c ?? "—").join(", ")}</div>
                {preview.errors.length > 0 && (
                  <ul className="max-h-32 overflow-y-auto text-[12px] text-destructive">
                    {preview.errors.slice(0, 50).map((e) => (
                      <li key={e.row}>
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                  </ul>
                )}
                <button className={cn(ctl, "border-ink bg-ink text-paper hover:bg-ink/90")} disabled={busy || !preview.created} onClick={() => void run()}>
                  Import {preview.created} items
                </button>
              </div>
            )}
          </Row>
        </Group>

        <Group title="Preferences">
          <Row
            label="Beep on scan"
            hint="Play a short sound when a code is recognised."
            control={
              <Switch
                label="Beep on scan"
                checked={sound}
                onChange={(v) => {
                  setSound(v);
                  localStorage.setItem("twothing.sound", v ? "on" : "off");
                }}
              />
            }
          />
        </Group>
      </div>
    </Page>
  );
}
