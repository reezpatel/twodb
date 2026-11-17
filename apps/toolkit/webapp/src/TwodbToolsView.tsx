import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { useTwodbAccess } from "./hooks/useTwodbAccess.js";
import { ScopeBar } from "./partials/ScopeBar.js";
import { ToolGroup } from "./partials/ToolGroup.js";
import { TableCard, TableEmpty } from "./lib/data-table.js";

/**
 * TwoDB tools page. The catalog is fixed (every installed app's API, as agent tools) — nothing to configure per tool.
 * Pick a space or an agent and tick the tools it may use; none are enabled by default. A call is allowed when the agent's
 * list OR the call's space list has the tool.
 */
export function TwodbToolsView({ data }: { data: ToolkitData }) {
  const a = useTwodbAccess();
  const [query, setQuery] = useState("");
  const [openApps, setOpenApps] = useState<Record<string, boolean>>({});

  const options = useMemo(() => {
    const list = a.scopeType === "space" ? data.spaces.map((s) => ({ id: s.id, name: s.name })) : data.agents.map((g) => ({ id: g.id, name: g.name }));
    return list.map((o) => ({ ...o, enabled: a.counts[`${a.scopeType}:${o.id}`] ?? 0 }));
  }, [a.scopeType, a.counts, data.spaces, data.agents]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const by = new Map<string, { slug: string; appName: string; tools: NonNullable<typeof a.catalog> }>();
    for (const t of a.catalog ?? []) {
      if (q && !`${t.key} ${t.description} ${t.appName}`.toLowerCase().includes(q)) continue;
      const g = by.get(t.app) ?? { slug: t.app, appName: t.appName, tools: [] };
      g.tools.push(t);
      by.set(t.app, g);
    }
    return [...by.values()];
  }, [a.catalog, query]);

  const total = a.catalog?.length ?? 0;
  const shownKeys = groups.flatMap((g) => g.tools.map((t) => t.key));
  const locked = !a.scopeId || a.loadingScope || a.saving;

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <p className="text-[12px] text-ink-muted">
          Every TwoDB app's API as tools for agents — the same surface as the <code className="font-mono">twodb</code> CLI. Nothing is enabled by default:
          pick a space or an agent and choose what it may use. A tool runs when it is enabled for the agent <em>or</em> for the space of the call.
        </p>

        <ScopeBar
          scopeType={a.scopeType}
          onScopeType={(t) => {
            if (a.dirty && !confirm("Discard unsaved changes?")) return;
            a.setScopeType(t);
            a.setScopeId(null);
          }}
          options={options}
          scopeId={a.scopeId}
          onScopeId={(id) => {
            if (a.dirty && !confirm("Discard unsaved changes?")) return;
            a.setScopeId(id);
          }}
          spaceCount={data.spaces.length}
          agentCount={data.agents.length}
          dirty={a.dirty}
          saving={a.saving}
          onSave={() => void a.save()}
          onDiscard={a.discard}
        />

        {a.error ? <p className="text-[12px] text-destructive">{a.error}</p> : null}

        {a.catalogError ? (
          <TableCard><TableEmpty><span className="text-destructive">Couldn't load the tool catalog: {a.catalogError}</span></TableEmpty></TableCard>
        ) : !a.catalog ? (
          <div className="flex justify-center py-12 text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools…" className="pl-8 text-[13px]" aria-label="Search tools" />
              </div>
              <span className="text-[12px] text-ink-muted" aria-live="polite">{a.draft.size} of {total} enabled</span>
              <div className="flex gap-2 sm:ml-auto">
                <Button size="sm" variant="secondary" disabled={locked || shownKeys.length === 0} onClick={() => a.toggle(shownKeys, true)}>
                  Select all{query.trim() ? " shown" : ""}
                </Button>
                <Button size="sm" variant="ghost" disabled={locked || shownKeys.length === 0} onClick={() => a.toggle(shownKeys, false)}>Clear</Button>
              </div>
            </div>

            {!a.scopeId ? (
              <p className="rounded-lg border border-dashed border-outline px-4 py-3 text-[12px] text-ink-muted">
                Choose a {a.scopeType === "space" ? "space" : "agent"} above to see and change what it can use.
              </p>
            ) : null}

            {groups.length === 0 ? (
              <TableCard><TableEmpty>No tools match “{query}”.</TableEmpty></TableCard>
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((g) => (
                  <ToolGroup
                    key={g.slug}
                    appName={g.appName}
                    slug={g.slug}
                    tools={g.tools}
                    enabled={a.draft}
                    open={query.trim() ? true : (openApps[g.slug] ?? false)}
                    disabled={locked}
                    onOpenChange={(o) => setOpenApps((s) => ({ ...s, [g.slug]: o }))}
                    onToggle={a.toggle}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
