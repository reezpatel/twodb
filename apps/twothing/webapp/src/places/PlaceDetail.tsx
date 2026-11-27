import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@twodb/blocks";
import { MoreHorizontal, MoveRight, Pencil, Plus, Printer, Waypoints } from "lucide-react";
import { api } from "../lib/api";
import { kindOf } from "../lib/catalog";
import { navigate } from "../lib/router";
import { ItemsTable } from "../items/partials/ItemsTable";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { DataTable, TableCard, Td, Tr } from "../ui/DataTable";
import { Page, PageHeader, Spinner, cbtn } from "../ui/Page";
import { QrSvg } from "../ui/QrSvg";
import { usePlaceDetail } from "./hooks/usePlaceDetail";

const heading = "text-[11px] font-semibold tracking-wider text-ink-muted uppercase";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink tabular-nums">{value}</dd>
    </div>
  );
}

export function PlaceDetail({ id }: { id: string }) {
  const h = usePlaceDetail(id);
  const p = h.place;
  if (h.notFound)
    return (
      <Page>
        <PageHeader title="Place not found" onBack="/places" />
      </Page>
    );
  if (h.loading || !p) return <Spinner />;
  const kind = kindOf(p.kind);
  const nested = p.totalItemCount - p.itemCount;

  return (
    <Page>
      <PageHeader
        onBack="/places"
        trail={p.path.slice(0, -1).map((c) => ({ label: c.name, to: `/places/${c.id}` }))}
        title={p.name}
        eyebrow={
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Stat label="Type" value={kind.label} />
            <Stat label="Items here" value={p.itemCount} />
            {nested > 0 && <Stat label="In nested places" value={nested} />}
            {p.childCount > 0 && <Stat label="Places inside" value={p.childCount} />}
          </dl>
        }
        actions={
          <>
            <button className={cbtn.secondary} onClick={h.putAway}>
              <Waypoints className="size-3.5" /> Put away here
            </button>
            <button className={cbtn.primary} onClick={h.addItem}>
              <Plus className="size-3.5" /> Add item
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More actions"
                  className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-ink/20 text-ink-muted transition hover:bg-stone hover:text-ink"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={h.edit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => h.setMoveOpen(true)}>
                  <MoveRight /> Move
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={h.addChild}>
                  <Plus /> Place inside
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* summary: label (stats sit in the header row with the actions) */}
      <div className="mb-8 space-y-5">
        {p.description && <p className="max-w-xl text-[13px] font-light text-ink-muted">{p.description}</p>}

        <div className="flex items-center gap-4">
          {p.code ? (
            <>
              <QrSvg text={p.code} className="size-20 rounded-[6px] border border-outline" />
              <div className="space-y-2">
                <div className="font-mono text-[15px] tracking-[0.15em] text-ink">{p.codeDisplay}</div>
                <button className={cbtn.secondary} onClick={h.print}>
                  <Printer className="size-3.5" /> Print label
                </button>
              </div>
            </>
          ) : (
            <p className="text-[12px] font-light text-ink-muted">Generating label…</p>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {p.imageId && <img src={api.imageUrl(p.imageId)} alt="" className="max-h-72 w-full rounded-[6px] border border-outline object-cover" />}

        {h.children.length > 0 && (
          <section className="space-y-3">
            <h2 className={heading}>Inside</h2>
            <TableCard>
              <DataTable minWidth={420} columns={["Place", { label: "Type", mobile: false }, { label: "Code", mobile: false }, "Items"]}>
                {h.children.map((c) => (
                  <Tr key={c.id} onClick={() => navigate(`/places/${c.id}`)}>
                    <Td className="font-medium text-ink">{c.name}</Td>
                    <Td hideOnMobile className="text-ink-muted">
                      {kindOf(c.kind).label}
                    </Td>
                    <Td hideOnMobile className="font-mono text-ink-muted">
                      {c.codeDisplay ?? "—"}
                    </Td>
                    <Td className="tabular-nums text-ink-muted">{c.totalItemCount || "—"}</Td>
                  </Tr>
                ))}
              </DataTable>
            </TableCard>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className={heading}>Items here ({h.items.length})</h2>
            <div className="ml-auto flex gap-2">
              {p.childCount > 0 && (
                <button className={cbtn.secondary} onClick={h.allItems}>
                  Incl. nested ({p.totalItemCount})
                </button>
              )}
              {h.items.length > 0 && (
                <button className={cbtn.secondary} onClick={h.printContents}>
                  <Printer className="size-3.5" /> Labels
                </button>
              )}
            </div>
          </div>
          {h.items.length > 0 ? (
            <ItemsTable items={h.items} onOpen={h.openItem} showPlace={false} />
          ) : (
            <TableCard>
              <p className="p-8 text-center text-[13px] font-light text-ink-muted">
                {p.name} is empty. Scan things into it with “Put away here”, or add an item.
              </p>
            </TableCard>
          )}
        </section>
      </div>

      <PlacePickerDialog
        open={h.moveOpen}
        onOpenChange={h.setMoveOpen}
        onPick={(x) => void h.moveTo(x)}
        exclude={p.id}
        selectedId={p.parentId}
        title={`Move “${p.name}” into…`}
        allowNone
      />
    </Page>
  );
}
