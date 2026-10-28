import type { ComponentProps, ReactNode } from "react";
import { Search, Star } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { cn } from "@/lib/utils";

export function ModelBrowserSearch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div data-slot="model-browser-search" className={cn("flex shrink-0 items-center gap-2 border-b px-4 py-2.5", className)}>
      <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <input
        type="search"
        aria-label="Search models"
        placeholder="Search models…"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
        {...props}
      />
    </div>
  );
}

type ModelBrowserListProps<T> = {
  data: T[];
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
};

/** Virtualized — only the rows in view are mounted, so thousands of models stay smooth. */
export function ModelBrowserList<T>({ data, getKey, renderRow, empty, className }: ModelBrowserListProps<T>) {
  return (
    <div data-slot="model-browser-list" role="listbox" aria-label="Models" className={cn("min-h-0 flex-1", className)}>
      {data.length === 0 ? (
        empty
      ) : (
        <Virtuoso style={{ height: "100%" }} data={data} computeItemKey={(_, item) => getKey(item)} itemContent={(_, item) => renderRow(item)} />
      )}
    </div>
  );
}

export function ModelBrowserEmpty({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="model-browser-empty" className={cn("text-muted-foreground px-4 py-12 text-center text-sm", className)} {...props} />;
}

type ModelBrowserRowProps = Omit<ComponentProps<"div">, "children"> & {
  label: string;
  modelId?: string;
  provider?: string;
  favorite?: boolean;
  selected?: boolean;
  badges?: ReactNode;
  favoriteLabel?: string;
  onSelect?: () => void;
  onToggleFavorite?: () => void;
};

export function ModelBrowserRow({
  label,
  modelId,
  provider,
  favorite = false,
  selected = false,
  badges,
  favoriteLabel,
  onSelect,
  onToggleFavorite,
  className,
  ...props
}: ModelBrowserRowProps) {
  return (
    <div
      data-slot="model-browser-row"
      data-selected={selected || undefined}
      data-favorite={favorite || undefined}
      className={cn("group/row flex items-center gap-1 px-2 py-0.5", className)}
      {...props}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-1 rounded-lg transition-colors", selected ? "bg-accent" : "hover:bg-accent/50")}>
        <button
          type="button"
          aria-label={favoriteLabel ?? (favorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`)}
          aria-pressed={favorite}
          onClick={onToggleFavorite}
          className={cn(
            "focus-visible:ring-ring ml-1 flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2",
            favorite ? "text-warning" : "text-muted-foreground/50 hover:text-foreground",
          )}
        >
          <Star className={cn("size-4", favorite && "fill-current")} aria-hidden="true" />
        </button>
        <button
          type="button"
          role="option"
          aria-selected={selected}
          onClick={onSelect}
          className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-3 text-left outline-none focus-visible:ring-2"
        >
          <span className="min-w-0 flex-1 flex flex-col gap-1">
            <span className="block truncate text-xs font-regular">{label}</span>
            {modelId || provider ? (
              <span className="text-muted-foreground block truncate text-xs">{[provider, modelId].filter(Boolean).join(" · ")}</span>
            ) : null}
          </span>
          {badges ? <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">{badges}</span> : null}
        </button>
      </div>
    </div>
  );
}
