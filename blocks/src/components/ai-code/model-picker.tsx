import * as React from "react";
import { Brain, Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog/dialog";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs/tabs";

export interface ModelEntry {
  /** Short identifier shown in the row, e.g. "opus-4.5", "k3". */
  id: string;
  /** Human label. Defaults to id. */
  label?: string;
  /** Context window, e.g. "200k". */
  context?: string;
  /** Whether the model supports extended thinking. */
  thinking?: boolean;
  /** Thinking levels this model supports (e.g. ["low","medium","high"]). Enables the effort selector when the model is selected. */
  thinkingLevels?: string[];
  /** Optional full identifier for the trigger chip (e.g. "GLM/glm-4.7"); rows show `label`. */
  triggerLabel?: string;
}

export interface ModelProvider {
  /** Provider key. */
  id: string;
  /** Provider title shown on the tab. */
  title: string;
  icon?: React.ElementType;
  models: ModelEntry[];
}

export interface ModelPickerProps {
  /** Grouped providers → tabs. */
  providers?: ModelProvider[];
  /** Flat model list (legacy) — wrapped into a single "All" tab. */
  models?: string[];
  /** Currently selected model id. */
  value: string;
  onChange?: (id: string) => void;
  /** Active thinking level for the selected model. */
  thinkingLevel?: string;
  onThinkingChange?: (level: string) => void;
}

function ModelPicker({ providers, models, value, onChange, thinkingLevel, onThinkingChange }: ModelPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const groups: ModelProvider[] = providers ?? [{ id: "all", title: "All", models: (models ?? []).map((m) => ({ id: m })) }];
  const [activeProvider, setActiveProvider] = React.useState(groups[0]?.id ?? "");

  // Reset search + active tab each open.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveProvider(groups[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The trigger always shows the model identifier (label), never the internal
  // value/id (which can be a connection-scoped key like "uuid::model").
  const selected = groups.flatMap((g) => g.models).find((m) => m.id === value);
  const selectedLabel = selected?.triggerLabel ?? selected?.label ?? (groups.flatMap((g) => g.models).length ? "Select model" : "No models");
  const effortLevels = selected?.thinkingLevels ?? (selected?.thinking ? ["low", "medium", "high"] : []);
  const activeEffort = thinkingLevel && effortLevels.includes(thinkingLevel) ? thinkingLevel : effortLevels[Math.floor(effortLevels.length / 2)] ?? effortLevels[0];

  const filtered = (list: ModelEntry[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.label ?? m.id).toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        data-slot="model-picker-trigger"
        aria-label={`Model: ${selectedLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground outline-none transition-colors min-h-6",
          "hover:bg-stone hover:text-ink data-[state=open]:bg-stone data-[state=open]:text-ink",
          "focus-visible:outline-2 focus-visible:outline-ion-deep disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <span data-slot="model-picker-label" className="flex items-baseline gap-1.5 whitespace-nowrap text-xs">
          <span className="text-ink">{selectedLabel}</span>
          {effortLevels.length > 0 && activeEffort ? (
            <span className="shrink-0 font-medium text-muted-foreground/70 capitalize tabular-nums">{activeEffort}</span>
          ) : null}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180" strokeWidth={2} aria-hidden="true" />
      </button>

      <DialogContent showClose={false} className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0" style={{ width: 560, maxWidth: "92vw" }} aria-describedby={undefined}>
        <DialogTitle className="sr-only">Choose a model</DialogTitle>
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-outline px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-ink outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded-[4px] border border-outline bg-stone px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        {/* Provider tabs + model table: clipped to the dialog's rounded corners */}
        <div className="flex max-h-[420px] flex-col overflow-hidden rounded-b-[10px]">
          {/* Provider tabs: horizontally scrollable (many providers must not
              push the whole dialog wider). A thin scrollbar appears on hover. */}
          <div className="border-b border-outline px-3 pt-2">
            <div className="-mx-3 overflow-x-auto [scrollbar-width:thin]" data-slot="model-picker-provider-scroll">
              <div className="px-3">
                <Tabs value={activeProvider} onValueChange={setActiveProvider}>
                  <TabsList variant="line" size="sm" className="border-b-0">
                    {groups.map((g) => {
                      const Icon = g.icon;
                      return (
                        <TabsTrigger key={g.id} value={g.id}>
                          {Icon ? <Icon strokeWidth={1.5} /> : null}
                          {g.title}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groups
              .filter((g) => g.id === activeProvider)
              .map((g) => {
                const list = filtered(g.models);
                if (!list.length) return <p key={g.id} className="px-3 py-6 text-center font-sans text-[13px] text-muted-foreground">No models match “{query}”.</p>;
                return (
                  <div key={g.id} className="flex flex-col">
                    {list.map((m) => {
                      const isSel = m.id === value;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onChange?.(m.id);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-[6px] px-3 py-2 text-left outline-none transition-colors",
                            isSel ? "bg-stone" : "hover:bg-stone/60",
                            "focus-visible:outline-2 focus-visible:outline-ion-deep",
                          )}
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center">{isSel ? <Check className="size-3.5 text-ion-deep" strokeWidth={2.5} /> : null}</span>
                          <span className="min-w-0 flex-1 font-mono text-[12.5px] text-ink">{m.label ?? m.id}</span>
                          {m.context ? <span className="shrink-0 font-sans text-[11px] text-muted-foreground tabular-nums">{m.context}</span> : null}
                          {m.thinking ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ion/40 px-2 py-0.5 font-sans text-[10px] font-medium text-ink">
                              <Brain className="size-3" strokeWidth={1.5} />
                              Thinking
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
          </div>

          {/* Effort (thinking level) — shown for the selected thinking model */}
          {effortLevels.length > 0 && (
            <div className="flex items-center gap-1.5 border-t border-outline px-3 py-2">
              <Brain className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <span className="mr-1 font-sans text-[11px] font-medium text-muted-foreground">Effort</span>
              {effortLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onThinkingChange?.(level)}
                  className={cn(
                    "rounded-[5px] px-2 py-1 font-sans text-[11px] font-medium capitalize outline-none transition-colors",
                    level === activeEffort ? "bg-stone text-ink" : "text-muted-foreground hover:text-ink",
                    "focus-visible:outline-2 focus-visible:outline-ion-deep",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ModelPicker };
