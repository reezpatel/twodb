import { cn } from "@twodb/blocks";
import { ChevronRight, Sparkles } from "lucide-react";
import { timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../ui/DataTable";
import { Page, PageHeader, Spinner } from "../ui/Page";
import { QrSvg } from "../ui/QrSvg";
import { useLabelsPage } from "./hooks/useLabelsPage";

const field = "h-8 rounded-[6px] border border-ink/20 bg-transparent px-2.5 text-[13px] outline-none transition placeholder:text-ink-muted focus:border-ink/50";

export function LabelsPage() {
  const h = useLabelsPage();
  return (
    <Page>
      <PageHeader title="Labels" />

      {/* generator hero */}
      <div className="relative mb-6 overflow-hidden rounded-[12px] border border-outline bg-card">
        <div className="pointer-events-none absolute -top-6 -right-6 hidden rotate-6 gap-2 opacity-90 md:grid md:grid-cols-3">
          {["K7QM2X", "9TRB4H", "XW3N0D", "M5PZ7A", "2HCQ8V", "QJ6KT1"].map((c) => (
            <div key={c} className="rounded-md border border-outline bg-white p-2 shadow-sm">
              <QrSvg text={c} className="size-16" quiet={0} />
              <div className="mt-1 text-center font-mono text-[10px] font-bold text-black">
                {c.slice(0, 3)}-{c.slice(3)}
              </div>
            </div>
          ))}
        </div>
        <div className="relative space-y-4 p-5 md:max-w-[60%] md:p-6">
          <div className="mb-6">
            <div className="text-[17px] font-normal">Generate a batch</div>
            <div className="text-[13px] font-light text-ink-muted">
              Non-sequential 6-character codes. Never one that's on an item or place, never one generated in the last {h.windowDays} days.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {h.presets.map((p) => (
              <button
                key={p}
                onClick={() => h.setCount(p)}
                className={cn(
                  "h-8 rounded-[6px] border px-2.5 text-[12px] font-medium tabular-nums transition",
                  h.count === p ? "border-ink bg-ink text-paper" : "border-ink/20 bg-paper hover:border-ink/40",
                )}
              >
                {p}
                {h.sheetSize && p % h.sheetSize === 0 ? (
                  <span className="ml-1 text-[11px] opacity-60">
                    · {p / h.sheetSize} sheet{p / h.sheetSize > 1 ? "s" : ""}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={1000}
              value={h.count}
              onChange={(e) => h.setCount(Number(e.target.value))}
              aria-label="Number of labels"
              className={cn(field, "w-20 tabular-nums")}
            />
            <input
              value={h.note}
              onChange={(e) => h.setNote(e.target.value)}
              placeholder="Note (optional) — e.g. “workshop drawers”"
              className={cn(field, "min-w-48 flex-1")}
            />
          </div>
          <button
            onClick={() => void h.generate()}
            disabled={h.busy}
            className="mt-6 inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-paper transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40"
          >
            <Sparkles className="size-3.5" /> {h.busy ? "Generating…" : `Generate ${h.count} & print`}
          </button>
        </div>
      </div>

      {h.loading ? (
        <Spinner />
      ) : (
        <TableCard>
          {h.batches.length === 0 ? (
            <TableEmpty>No batches yet. Generate your first one above.</TableEmpty>
          ) : (
            <DataTable minWidth={560} columns={["Batch", { label: "Created", mobile: false }, "Used", ""]}>
              {h.batches.map((b) => (
                <Tr key={b.id} onClick={() => navigate(`/labels/batch/${b.id}`)}>
                  <Td className="font-medium text-ink">{b.note || `${b.count} labels`}</Td>
                  <Td hideOnMobile className="text-ink-muted">
                    {new Date(b.createdAt).toLocaleDateString()} · {timeAgo(b.createdAt)}
                    {b.live < b.count && ` · ${b.count - b.live} re-issued later`}
                  </Td>
                  <Td className="tabular-nums text-ink-muted">
                    {b.used}/{b.live}
                  </Td>
                  <Td className="w-8 text-right">
                    <ChevronRight className="size-4 text-ink-muted" />
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
        </TableCard>
      )}
    </Page>
  );
}
