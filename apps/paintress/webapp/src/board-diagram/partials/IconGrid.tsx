import { Search } from "lucide-react";
import type { IconHit } from "../../lib/paintress-client";
import { paintressClient } from "../../lib/paintress-client";
import { PaletteItem } from "./PaletteItem";

const SETS = [
  [undefined, "All"],
  ["logos", "Tech + AWS"],
  ["gcp", "Google Cloud"],
  ["carbon", "Infra"],
  ["mdi", "General"],
] as const;

const pretty = (name: string) => name.replace(/^aws-/, "").replace(/-icon$/, "").replace(/[-_]/g, " ");

export function IconGrid(props: {
  query: string;
  onQuery(q: string): void;
  set: string | undefined;
  onSet(s: string | undefined): void;
  icons: IconHit[];
  searching: boolean;
  onAdd(icon: IconHit): void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 size-3.5 text-ink-muted" />
        <input
          autoFocus
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          placeholder="Search: lambda, postgres, kafka, bigquery…"
          className="h-7 w-full rounded-full border border-outline bg-paper pl-7 pr-2 text-[12px] outline-none focus:border-ion-deep"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {SETS.map(([id, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => props.onSet(id)}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${props.set === id ? "border-ink bg-ink text-paper" : "border-outline text-ink-muted hover:bg-paper-grid"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!props.query.trim() && <div className="text-[11px] text-ink-muted">Type to search ~4,000 icons — AWS and Google Cloud services, databases, brokers, languages, generic infrastructure.</div>}
      {props.query.trim() && !props.icons.length && !props.searching && <div className="text-[11px] text-ink-muted">No icons found.</div>}
      <div className="grid grid-cols-3 gap-1">
        {props.icons.map((i) => (
          <PaletteItem key={i.id} title={i.id} label={pretty(i.name)} payload={{ kind: "icon", icon: i.id, label: pretty(i.name) }} onClick={() => props.onAdd(i)}>
            <img src={paintressClient.iconUrl(i.id)} alt={i.name} loading="lazy" draggable={false} className="size-8 object-contain" />
          </PaletteItem>
        ))}
      </div>
    </div>
  );
}
