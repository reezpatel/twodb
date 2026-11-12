import { Dialog, DialogContent, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@twodb/blocks";
import { formatAppName } from "../../lib/app-name.js";
import { appState } from "../../lib/app-state.js";
import { AppStateDot } from "../registry/partials/AppStateDot.js";
import { PaneHeader } from "../shell/partials/PaneHeader.js";
import { useAppDetails } from "./hooks/useAppDetails.js";
import { useEndpointSort } from "./hooks/useEndpointSort.js";
import { EndpointDialogContent } from "./partials/EndpointDialog.js";
import { EndpointTable } from "./partials/EndpointTable.js";
import { MessagesView } from "./partials/MessagesView.js";

/** Only calls its holding hook and renders partials. One app: its contract in two tabs. */
export function AppDetails() {
  const d = useAppDetails();
  const endpointSort = useEndpointSort(d.endpoints?.endpoints ?? []);
  const title = d.app ? formatAppName(d.app.name) : (d.slug ?? "");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <PaneHeader
        title={title}
        description={
          d.app ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <AppStateDot state={appState(d.app)} />
              <code className="font-mono text-xs">{d.app.basePath}</code>
            </span>
          ) : d.appLoading ? (
            "Loading…"
          ) : (
            "This app isn't registered with the gateway."
          )
        }
      />

      {d.error ? <p className="mb-4 text-sm text-ink-muted">{d.error}</p> : null}
      {d.contractLoading ? <p className="text-sm text-ink-muted">Loading contract…</p> : null}

      {d.endpoints ? (
        <Tabs value={d.tab} onValueChange={d.setTab}>
          <TabsList variant="line">
            <TabsTrigger value="endpoints">Endpoints ({d.endpoints.endpoints.length})</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="pt-3">
            <EndpointTable
              endpoints={endpointSort.sorted}
              selectedName={d.selectedEndpoint?.name ?? null}
              sortKey={endpointSort.sortKey}
              sortDir={endpointSort.sortDir}
              onToggleSort={endpointSort.toggleSort}
              onSelect={d.select}
            />
          </TabsContent>

          <TabsContent value="messages" className="pt-3">
            {d.messages ? <MessagesView messages={d.messages} /> : <p className="text-sm text-ink-muted">No messages contract found.</p>}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Endpoint inspector dialog — opens when an endpoint row is clicked */}
      {d.endpoints ? (
        <Dialog open={d.selectedEndpoint !== null} onOpenChange={(open) => !open && d.select(null)}>
          <DialogContent className="max-w-2xl">
            {d.selectedEndpoint ? (
              <>
                {/* Not rendered visually (TryItBar shows method + path) but required by Radix for screen readers. */}
                <DialogTitle className="sr-only">
                  {d.selectedEndpoint.method} {d.selectedEndpoint.path}
                </DialogTitle>
                <EndpointDialogContent
                  appSlug={d.endpoints.slug}
                  basePath={d.endpoints.basePath}
                  endpoint={d.selectedEndpoint}
                  pathInput={d.pathInput}
                  bodyInput={d.bodyInput}
                  sending={d.sending}
                  result={d.result}
                  onPathChange={d.setPathInput}
                  onBodyChange={d.setBodyInput}
                  onSend={d.send}
                />
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
