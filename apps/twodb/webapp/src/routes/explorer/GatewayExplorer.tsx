import { Tabs, TabsList, TabsTrigger, TabsContent } from "@twodb/blocks";
import { toast } from "sonner";
import { useGatewayExplorer } from "./hooks/useGatewayExplorer.js";
import { AppTabs } from "./partials/AppTabs.js";
import { EndpointTable } from "./partials/EndpointTable.js";
import { useEndpointSort } from "./hooks/useEndpointSort.js";
import { EndpointDialogContent } from "./partials/EndpointDialog.js";
import { MessagesView } from "./partials/MessagesView.js";
import { Dialog, DialogContent, DialogTitle } from "@twodb/blocks";

/** Only calls its holding hook and renders partials. The URL owns the app + tab. */
export function GatewayExplorer() {
  const {
    apps,
    appsLoading,
    selectedSlug,
    setSelectedSlug,
    tab,
    setTab,
    endpoints,
    messages,
    contractLoading,
    error,
    selectedEndpoint,
    select,
    pathInput,
    setPathInput,
    bodyInput,
    setBodyInput,
    sending,
    result,
    send,
  } = useGatewayExplorer();

  const endpointSort = useEndpointSort(endpoints?.endpoints ?? []);

  const explore = (slug: string) => {
    if (slug === selectedSlug) return;
    setSelectedSlug(slug);
    select(null);
    const app = apps.find((a) => a.slug === slug);
    toast.success(`${app?.name ?? slug} selected`, {
      description: "Loading its endpoint contract — try any route through the gateway.",
    });
  };

  return (
    <div className="flex min-h-0 flex-1 gap-0">
      {/* Main column — app picker + contract. Padding lives here so the
          right-docked sidebar sits flush to the shell edge, not inside padding. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-6">
        {/* App picker — simple tab strip, one tab per connected app */}
        <section>
          <AppTabs apps={apps} value={selectedSlug} onValueChange={explore} />
        </section>

        {/* Contract pane */}
        {selectedSlug ? (
          <section className="min-h-0 min-w-0">
            {error ? <p style={{ opacity: 0.7 }}>{error}</p> : null}
            {contractLoading ? <p>Loading contract…</p> : null}

            {endpoints ? (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList variant="line">
                  <TabsTrigger value="endpoints">Endpoints ({endpoints.endpoints.length})</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>

                <TabsContent value="endpoints" className="pt-2">
                  <EndpointTable
                    endpoints={endpointSort.sorted}
                    selectedName={selectedEndpoint?.name ?? null}
                    sortKey={endpointSort.sortKey}
                    sortDir={endpointSort.sortDir}
                    onToggleSort={endpointSort.toggleSort}
                    onSelect={select}
                  />
                </TabsContent>

                <TabsContent value="messages" className="pt-2">
                  {messages ? <MessagesView messages={messages} /> : <p style={{ opacity: 0.6 }}>No messages contract found.</p>}
                </TabsContent>
              </Tabs>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Endpoint inspector dialog — opens when an endpoint row is clicked */}
      {endpoints ? (
        <Dialog open={selectedEndpoint !== null} onOpenChange={(open) => !open && select(null)}>
          <DialogContent className="max-w-2xl">
            {selectedEndpoint ? (
              <>
                {/* Not rendered visually (TryItBar shows method + path) but
                    required by Radix for screen-reader announcement. */}
                <DialogTitle className="sr-only">
                  {selectedEndpoint.method} {selectedEndpoint.path}
                </DialogTitle>
                <EndpointDialogContent
                  appSlug={endpoints.slug}
                  basePath={endpoints.basePath}
                  endpoint={selectedEndpoint}
                  pathInput={pathInput}
                  bodyInput={bodyInput}
                  sending={sending}
                  result={result}
                  onPathChange={setPathInput}
                  onBodyChange={setBodyInput}
                  onSend={send}
                />
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
