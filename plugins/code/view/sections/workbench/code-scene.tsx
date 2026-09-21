import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Resizable, ResizablePanel } from "@twodb/ui";
import { llmConnectionsQueryKey, llmRepo, type LlmConnectionOption, type LlmProviderCatalog } from "../../lib/api";
import { useCodeData } from "../../hooks/use-code-data";
import { useSessionSocket } from "../../hooks/use-session-socket";
import { ChatSection } from "./chat-section";
import { Ribbon } from "./ribbon";
import { Sidenav } from "./sidenav";
import { Sidebar } from "./sidebar";
import { codeSceneNextStyles as codeSceneStyles } from "./code-scene.style";

export function CodeScene() {
  const { sessionsQuery } = useCodeData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = sessionsQuery.data?.sessions ?? [];
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  const connectionsQuery = useQuery({
    queryKey: [...llmConnectionsQueryKey],
    queryFn: () => llmRepo.listOverview(),
    staleTime: 60_000,
  });
  const connections = (connectionsQuery.data?.connections ?? []).filter((connection) => connection.enabled);
  const providers = connectionsQuery.data?.providers ?? [];

  const stream = useSessionSocket(selectedId);

  const runningIds = new Set<string>();
  if (selectedId && stream.running) runningIds.add(selectedId);

  const changeConnection = (connectionId: string | null) => {
    stream.setConnection(connectionId);
    stream.setModel(null);
    void sessionsQuery.refetch();
  };

  const changeModel = (model: string | null) => {
    stream.setModel(model);
    void sessionsQuery.refetch();
  };

  return (
    <div className="code-next">
      <style jsx>{codeSceneStyles}</style>
      <div />
      <div className="code-next__body">
        <Resizable direction="horizontal">
          <ResizablePanel size={240} minSize={180} maxSize={400}>
            <div className="code-next__pane-side">
              <Ribbon />
              <Sidenav
                sessions={sessions}
                runningIds={runningIds}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={(session) => session && setSelectedId(session.id)}
              />
            </div>
          </ResizablePanel>
          <ResizablePanel size="auto">
            <ChatSection
              sessionId={selectedId}
              events={stream.events}
              running={stream.running}
              send={stream.send}
              sessionTitle={selected?.title ?? ""}
              sessionFolder={selected?.folder ?? ""}
              connections={connections}
              connectionId={selected?.connection_id ?? null}
              onConnectionChange={changeConnection}
              model={selected?.model ?? null}
              onModelChange={changeModel}
              providers={providers}
            />
          </ResizablePanel>
          <ResizablePanel size="26%" minSize="15%" maxSize="45%">
            <div className="code-next__pane-side">
              <Sidebar
                session={selected}
                events={stream.events}
                connectionName={connections.find((connection) => connection.id === selected?.connection_id)?.name ?? null}
              />
            </div>
          </ResizablePanel>
        </Resizable>
      </div>
    </div>
  );
}
