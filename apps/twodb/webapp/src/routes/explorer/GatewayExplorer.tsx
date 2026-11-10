import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@twodb/blocks";
import { useGatewayExplorer } from "./hooks/useGatewayExplorer.js";
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

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* App picker */}
      <div style={{ minWidth: 180, borderRight: "1px solid var(--border, #e5e7eb)", paddingRight: 8 }}>
        <h4 style={{ fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>Apps</h4>
        {apps.map((app) => (
          <button
            key={app.slug}
            onClick={() => {
              setSelectedSlug(app.slug);
              select(null);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              background: selectedSlug === app.slug ? "var(--accent, #e5e7eb)" : "transparent",
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 14 }}>{app.name}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              {app.status === "active" ? "● " : "○ "}
              {app.status}
              {app.version ? ` · v${app.version}` : ""}
            </div>
          </button>
        ))}
      </div>

      {/* Contract pane */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
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
      </div>
    </div>
  );
}
