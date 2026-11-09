import { useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useImport } from "./use-import";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import items from CSV</DialogTitle>
          <DialogDescription>
            Rows with an existing barcode update that item; the rest are created. Locations written as “Warehouse › Rack › Box” are created when missing.
          </DialogDescription>
        </DialogHeader>
        {open ? <ImportBody onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const imp = useImport();
  const input = useRef<HTMLInputElement>(null);
  const headers = imp.result?.headers ?? [];
  const mapped = new Set(Object.values(imp.mapping ?? {}));
  const needsTitle = !!imp.result && !mapped.has("title");

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && void imp.load(e.target.files[0])} />
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => input.current?.click()} disabled={imp.preview.isPending || imp.commit.isPending}>
          {imp.preview.isPending ? <Loader2 className="animate-spin" /> : <FileUp />} Choose CSV file
        </Button>
        <span className="text-muted-foreground truncate text-sm">{imp.fileName}</span>
      </div>

      {imp.result && !imp.committed ? (
        <>
          <p className="text-sm">{imp.result.total} row{imp.result.total === 1 ? "" : "s"} found. Match columns to fields:</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="min-w-32 px-2 py-2 text-left font-medium">
                      <div className="mb-1 truncate">{h}</div>
                      <select
                        className="border-input bg-background h-7 w-full rounded border px-1 text-xs"
                        value={imp.mapping?.[h] ?? ""}
                        onChange={(e) => {
                          const next = { ...imp.mapping };
                          if (e.target.value) next[h] = e.target.value;
                          else delete next[h];
                          imp.setMapping(next);
                        }}
                      >
                        <option value="">Ignore</option>
                        {imp.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imp.result.preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    {headers.map((h, j) => (
                      <td key={h} className="max-w-48 truncate px-2 py-1.5">
                        {row[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needsTitle ? <p className="text-destructive text-xs">Map one column to “Title”.</p> : null}
          <div className="flex justify-end">
            <Button disabled={needsTitle || imp.commit.isPending} onClick={() => imp.commit.mutate()}>
              {imp.commit.isPending ? <Loader2 className="animate-spin" /> : null}
              Import {imp.result.total} rows
            </Button>
          </div>
        </>
      ) : null}

      {imp.committed && imp.result ? (
        <div className="space-y-2 text-sm">
          <p>
            Created <strong>{imp.result.created}</strong>, updated <strong>{imp.result.updated}</strong>
            {imp.result.locationsCreated ? `, ${imp.result.locationsCreated} new location${imp.result.locationsCreated === 1 ? "" : "s"}` : ""}.
          </p>
          {imp.result.errors.length > 0 ? (
            <ul className="text-destructive max-h-40 list-disc overflow-y-auto pl-5 text-xs">
              {imp.result.errors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={imp.reset}>
              Import another
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : null}
      {imp.error ? <p className="text-destructive text-sm">{imp.error}</p> : null}
    </div>
  );
}
