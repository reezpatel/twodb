import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { artisanClient, type ModelInfo } from "../../lib/artisan-client.js";
import { AgentView } from "../agents/AgentView.js";

const noop = () => {};

/** Settings page: the one agent behind every llm_chat session — the regular agent page (Instruction + Config tabs, no Sessions). */
export function ChatAgentView() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    artisanClient.getChatAgent().then((a) => setAgentId(a.id)).catch((e: Error) => setError(e.message));
    artisanClient.listModels().then(setModels).catch(() => {});
  }, []);

  if (error) return <p className="p-6 text-[13px] text-destructive">{error}</p>;
  if (!agentId) return <div className="flex flex-1 items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>;
  return <AgentView agentId={agentId} models={models} directories={[]} onStartChat={async () => {}} onOpenSession={noop} onChanged={noop} />;
}
