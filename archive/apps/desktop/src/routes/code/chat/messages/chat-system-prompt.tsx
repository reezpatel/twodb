import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import {
  CodeChatSystemPrompt,
  CodeChatSystemPromptContent,
  CodeChatSystemPromptHeader,
  CodeChatSystemPromptText,
  CodeChatSystemPromptWarning,
} from "@/components/blocks/code/code-chat/code-chat-system-prompt";
import { api } from "@/lib/api";

interface SessionPromptResolution {
  systemPrompt: string;
  skills: { name: string; source: string }[];
  instructions: { id: string; instruction: string }[];
  memories: { id: string; title: string; level: string }[];
  mcpTools: { server: string; name: string }[];
  mcpFailures: { server: string; error: string }[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Collapsible view of the exact system prompt the next run sends — settings
 * override/default, cwd, [Skills] titles, and inline instructions. Fetched
 * lazily on first expand. Pass `endpoint` for non-code chats (assistant).
 */
export function ChatSystemPrompt({ endpoint }: { endpoint?: string }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const url = endpoint ?? (sessionId ? `/api/code/sessions/${sessionId}/system-prompt` : null);
  const [fetched, setFetched] = useState(false);

  const resolution = useQuery({
    queryKey: ["system-prompt", url],
    queryFn: () => api<SessionPromptResolution>(url!),
    enabled: !!url && fetched,
  });

  const data = resolution.data;
  const skills = data?.skills ?? [];
  const instructions = data?.instructions ?? [];
  const memories = data?.memories ?? [];
  const mcpServers = [...new Set((data?.mcpTools ?? []).map((t) => t.server))];
  const mcpFailures = data?.mcpFailures ?? [];
  const summary = [
    skills.length > 0 ? plural(skills.length, "skill", "skills") : null,
    instructions.length > 0 ? plural(instructions.length, "instruction", "instructions") : null,
    memories.length > 0 ? plural(memories.length, "memory", "memories") : null,
    mcpServers.length > 0 ? plural(mcpServers.length, "MCP server", "MCP servers") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CodeChatSystemPrompt onOpenChange={(open) => open && setFetched(true)}>
      <CodeChatSystemPromptHeader summary={summary || undefined} loading={fetched && resolution.isPending} />
      <CodeChatSystemPromptContent>
        {mcpFailures.length > 0 && (
          <CodeChatSystemPromptWarning>
            MCP unreachable: {mcpFailures.map((f) => `${f.server} (${f.error.slice(0, 80)})`).join("; ")}
          </CodeChatSystemPromptWarning>
        )}
        <CodeChatSystemPromptText>{data?.systemPrompt ?? "…"}</CodeChatSystemPromptText>
      </CodeChatSystemPromptContent>
    </CodeChatSystemPrompt>
  );
}
