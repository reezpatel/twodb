import { Brain, Eye, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ClaudeModelSelector from "@/components/ui/claude-model-selector";
import { ProviderLogo } from "@/components/provider-logo";
import { fmtTokens } from "./stats-row";
import type { ModelConfig } from "./use-model-config";
import { cn } from "@/lib/utils";

/** Two-panel provider/model browser plus the thinking effort slider. */
export function ModelDialog({ config }: { config: ModelConfig }) {
  const {
    connections,
    selected,
    models,
    effectiveModel,
    model,
    modelSearch,
    setModelSearch,
    visibleModels,
    providerLabel,
    thinkingLevels,
    thinkingIndex,
    configOpen,
    setConfigOpen,
    showThinking,
    selectConnection,
    selectModel,
    changeThinking,
  } = config;

  return (
    <Dialog open={configOpen} onOpenChange={setConfigOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Model &amp; thinking</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid h-96 max-h-[52vh] grid-cols-[230px_1fr] grid-rows-[minmax(0,1fr)]">
            <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto pr-4">
              <div className="flex flex-col gap-1">
                {connections.length === 0 && <p className="text-muted-foreground px-2 py-3 text-xs">No connections — add one in Settings → LLM.</p>}
                {connections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "hover:bg-accent/50 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                      selected?.id === c.id && "bg-accent",
                    )}
                    onClick={() => selectConnection(c.id)}
                  >
                    <span className="bg-muted text-foreground/80 flex size-8 shrink-0 items-center justify-center rounded-lg border">
                      <ProviderLogo provider={c.provider} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">{providerLabel(c.provider)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col border-l pl-4">
              <div className="flex items-center gap-2 pb-2">
                <Search size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
                <Input
                  className="h-6 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                  placeholder="Search models…"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-0.5 pr-2">
                  {models.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-6 text-center text-xs">No models — refresh in Settings → LLM.</p>
                  ) : visibleModels.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-6 text-center text-xs">No models match “{modelSearch}”.</p>
                  ) : (
                    visibleModels.map((m) => {
                      const active = (model || effectiveModel) === m.modelId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={cn(
                            "hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                            active && "bg-accent",
                          )}
                          onClick={() => selectModel(m.modelId)}
                        >
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full border", active ? "bg-primary border-primary" : "border-muted-foreground/40")}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{m.displayName ?? m.modelId}</span>
                            {m.displayName && m.displayName !== m.modelId ? (
                              <span className="text-muted-foreground block truncate font-mono text-[10px]">{m.modelId}</span>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
                            {m.input
                              .filter((i) => i !== "text")
                              .map((i) =>
                                i === "image" ? (
                                  <Eye key={i} size={11} aria-label="image input" />
                                ) : (
                                  <span key={i} className="font-mono text-[10px]">
                                    {i}
                                  </span>
                                ),
                              )}
                            {m.thinking && <Brain size={11} aria-label="thinking" />}
                            {m.contextWindow ? <span className="font-mono text-[10px]">{fmtTokens(m.contextWindow)}</span> : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {showThinking === false ? null : thinkingLevels.length >= 2 ? (
            <ClaudeModelSelector
              inline
              levels={thinkingLevels}
              value={thinkingIndex === -1 ? Math.min(2, thinkingLevels.length - 1) : thinkingIndex}
              onValueChange={(level) => changeThinking(level)}
            />
          ) : (
            <p className="text-muted-foreground px-1 text-xs">This model doesn't support thinking levels.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
