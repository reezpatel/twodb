import { useEffect, useState } from "react";
import { ArrowUp, Bot, Check, Loader2, Send, Square, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Agent } from "@/routes/settings/llm/use-workspace";
import { useChatPanel, ChatContext } from "./use-chat-panel";
import { ChatConversationInner } from "./chat-conversation";
import { useSessionDirectory } from "./use-session-directory";

interface BtwDialogProps {
  /** "" → agent picker; session id → side-thread chat. */
  btwSessionId: string;
  seed?: string;
  onClose: () => void;
  onStart: (agentId: string, question: string) => void;
}

/** Fetches the btw session row (locked + interactive drive the footer buttons). */
function useBtwSession(sessionId: string) {
  return useQuery({
    queryKey: ["code", "btw-session", sessionId],
    queryFn: () => api<{ id: string; locked: boolean; interactive: boolean; title: string }>(`/api/code/sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function BtwDialog({ btwSessionId, seed, onClose, onStart }: BtwDialogProps) {
  const [question, setQuestion] = useState(seed ?? "");

  // ----- agent picker state -------------------------------------------------
  const agents = useQuery({
    queryKey: ["workspace", "agents"],
    queryFn: () => api<Agent[]>("/api/agents"),
  });
  const { directoryId } = useSessionDirectory();
  const pickable = (agents.data ?? []).filter((a) => a.type !== "sentinel");

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const start = (agentId: string) => {
    onStart(agentId, question.trim());
  };

  const btwSession = useBtwSession(btwSessionId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex h-[80vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">/btw side thread</DialogTitle>

        {btwSessionId === "" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-primary" aria-hidden="true" />
                <span className="text-sm font-medium">/btw — side thread</span>
                <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} title="Close">
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you want to ask on the side?"
                className="bg-background min-h-24 w-full resize-none rounded-md border p-3 font-mono text-xs outline-none focus-visible:border-ring"
                autoFocus
              />
              <p className="text-muted-foreground text-xs">Pick an agent — the side thread runs with its prompt and tools.</p>
              <div className="flex flex-col gap-1.5">
                {agents.isPending && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Loader2 size={12} className="animate-spin" /> loading agents…
                  </div>
                )}
                {pickable.map((agent) => (
                  <button
                    key={agent.id}
                    className={cn(
                      "hover:bg-accent/50 flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                      selectedAgent === agent.id && "border-ring bg-accent",
                    )}
                    onClick={() => setSelectedAgent(agent.id)}
                    disabled={agent.codeDirectoryId !== null && agent.codeDirectoryId !== directoryId}
                    title={agent.codeDirectoryId !== null && agent.codeDirectoryId !== directoryId ? "different workspace" : undefined}
                  >
                    <Bot size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{agent.description || `${agent.provider} · ${agent.model}`}</span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {agent.type} · {agent.provider}/{agent.model}
                        {agent.tools.includes("all") ? " · all tools" : agent.tools.length ? ` · ${agent.tools.length} tools` : " · no tools"}
                      </span>
                    </span>
                    {selectedAgent === agent.id && <Check size={14} className="text-primary" />}
                  </button>
                ))}
                {!agents.isPending && pickable.length === 0 && (
                  <p className="text-muted-foreground text-xs">No agents configured — add one in Settings → LLM → Agents.</p>
                )}
              </div>
            </div>

            <div className="border-t px-4 py-2.5">
              <Button size="sm" className="ml-auto" disabled={!selectedAgent} onClick={() => selectedAgent && start(selectedAgent)}>
                <ArrowUp size={12} /> Start side thread
              </Button>
            </div>
          </div>
        ) : (
          <BtwChat
            sessionId={btwSessionId}
            seed={seed}
            locked={btwSession.data?.locked ?? false}
            interactive={btwSession.data?.interactive ?? true}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The side thread itself — a second chat panel bound to the btw session. */
function BtwChat({
  sessionId,
  seed,
  locked,
  interactive,
  onClose,
}: {
  sessionId: string;
  seed?: string;
  locked: boolean;
  interactive: boolean;
  onClose: () => void;
}) {
  const chat = useChatPanel(sessionId);

  // Seed the composer with the /btw question so one Send starts the thread.
  useEffect(() => {
    if (seed && !chat.draft) chat.setDraft(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (locked) chat.setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  return (
    <ChatContext.Provider value={chat}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b flex items-center gap-2 px-4 py-2.5">
          <Bot size={15} className="text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">/btw</span>
          {!interactive && !locked && <span className="text-muted-foreground ml-1 text-[11px] italic">headless subagent — it will not ask you questions</span>}
          {locked && <span className="text-muted-foreground ml-1 text-[11px] italic">read-only — thread closed</span>}
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} title="Close (thread stays; reopen from the block in the main chat)">
            <X size={14} />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatConversationInner sessionId={sessionId} />
        </div>
        <div className="border-t flex items-center gap-1.5 px-4 py-2.5">
          {locked ? (
            <span className="text-muted-foreground text-xs">This thread is closed.</span>
          ) : !interactive ? (
            <span className="text-muted-foreground text-xs">Headless run — steering input is delivered when the agent finishes its current work.</span>
          ) : (
            <>
              {chat.streaming !== null && (
                <Button size="sm" variant="destructive" title="Stop" onClick={chat.stop}>
                  <Square size={12} /> Stop
                </Button>
              )}
              <Button
                size="sm"
                className="ml-auto"
                title="Summarize with the same LLM and send it to the main thread as a round"
                disabled={chat.streaming !== null || chat.wsStatus !== "open"}
                onClick={() => chat.btwDone(true)}
              >
                <Send size={12} /> Send to main
              </Button>
              <Button
                size="sm"
                variant="outline"
                title="Close the side thread (no summary)"
                disabled={chat.streaming !== null}
                onClick={() => chat.btwDone(false)}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </ChatContext.Provider>
  );
}
