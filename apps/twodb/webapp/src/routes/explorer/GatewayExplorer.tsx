import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@twodb/blocks";
import { toast } from "sonner";
import { useGatewayExplorer } from "./hooks/useGatewayExplorer.js";
import { AppCardGrid } from "./partials/AppCardGrid.js";
import { EndpointListItem } from "./partials/EndpointListItem.js";
import { EndpointDetail } from "./partials/EndpointDetail.js";
import { TryItPanel } from "./partials/TryItPanel.js";
import { MessagesView } from "./partials/MessagesView.js";

/** Only calls its holding hook and renders partials. */
export function GatewayExplorer() {
  const {
    apps,
    appsLoading,
    selectedSlug,
    setSelectedSlug,
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

  const [tab, setTab] = useState("endpoints");

  if (appsLoading) return <p>Loading…</p>;

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
    <div className="flex flex-col gap-6">
      {/* App picker — connect-style card grid */}
      <section>
        <p className="text-sm font-medium text-ink-muted">Gateway explorer</p>
        <h2 className="mt-1 font-sans text-2xl font-bold tracking-tight text-ink">Connected apps</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          Pick an app to inspect its API contract and call its endpoints through the gateway.
        </p>
        <div className="mt-4">
          <AppCardGrid apps={apps} selectedSlug={selectedSlug} onExplore={explore} />
        </div>
      </section>

      {/* Contract pane */}
      {selectedSlug ? (
        <section className="min-w-0">
          {error ? <p style={{ opacity: 0.7 }}>{error}</p> : null}
          {contractLoading ? <p>Loading contract…</p> : null}

          {endpoints ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="endpoints">Endpoints ({endpoints.endpoints.length})</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>

              <TabsContent value="endpoints">
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ minWidth: 260 }}>
                    {endpoints.endpoints.map((ep) => (
                      <EndpointListItem
                        key={`${ep.method} ${ep.path}`}
                        endpoint={ep}
                        selected={selectedEndpoint?.name === ep.name}
                        onSelect={() => select(ep)}
                      />
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {selectedEndpoint ? (
                      <>
                        <EndpointDetail appSlug={endpoints.slug} basePath={endpoints.basePath} endpoint={selectedEndpoint} />
                        <TryItPanel
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
                    ) : (
                      <p style={{ opacity: 0.6 }}>Select an endpoint to inspect its contract.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages">
                {messages ? <MessagesView messages={messages} /> : <p style={{ opacity: 0.6 }}>No messages contract found.</p>}
              </TabsContent>
            </Tabs>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
