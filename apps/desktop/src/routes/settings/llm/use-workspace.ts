import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Skill {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this skill belongs to; null = all spaces. */
  spaceId: string | null;
  name: string;
  description: string;
  content: string;
  tags: string[];
  /** false → hidden from the AI: not listed in the prompt, read_skill fails; user-only via /name. */
  aiVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AgentType = "sub_agent" | "persona" | "collaborator" | "sentinel";

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  sub_agent: "Subagent for code",
  persona: "Persona",
  collaborator: "Collaborator",
  sentinel: "Sentinel",
};

export interface Agent {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this agent belongs to; null = all spaces. */
  spaceId: string | null;
  provider: string;
  model: string;
  description: string | null;
  instruction: string;
  tags: string[];
  /** sub_agent | persona | collaborator | sentinel. */
  type: AgentType;
  /** Tool allowlist — ["all"] = every tool; [] = no tools. */
  tools: string[];
  /** Persona only: directory its sessions run in; null = inherit the invoking session's. */
  workDirectoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this server belongs to; null = all spaces. */
  spaceId: string | null;
  name: string;
  url: string;
  transport: string;
  headers: Record<string, string>;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Where a memory lives: org-wide, one code directory, one agent's own ("self"), or a single session (legacy). */
export type MemoryScope = "organization" | "code_directory" | "agent" | "session";

export const MEMORY_SCOPE_LABELS: Record<MemoryScope, string> = {
  organization: "Organization",
  code_directory: "Code directory",
  agent: "Agent (self)",
  session: "Session",
};

export interface Memory {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this memory belongs to; null = all spaces. */
  spaceId: string | null;
  scopeId: string | null;
  scope: MemoryScope;
  /** Owner when scope = agent (persona / collaborator / sentinel). */
  agentId: string | null;
  /** Listed by default; the content opens on click. Unique per level. */
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Instruction {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this instruction belongs to; null = all spaces. */
  spaceId: string | null;
  instruction: string;
  instructionPath: string | null;
  hash: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Shared tag suggestion list across skills, agents, memories and instructions. */
export function useTagSuggestions() {
  return useQuery({ queryKey: ["workspace", "llm-tags"], queryFn: () => api<string[]>("/api/llm-tags") });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generic list/save/delete over one of the workspace resource endpoints. */
function useResource<T extends { id: string }>(resource: string) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["workspace", resource],
    queryFn: () => api<T[]>(`/api/${resource}`),
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["workspace", resource] });
    void queryClient.invalidateQueries({ queryKey: ["workspace", "llm-tags"] });
  };

  const save = useMutation({
    mutationFn: (input: Partial<T> & { id?: string }) =>
      api<T>(input.id ? `/api/${resource}/${input.id}` : `/api/${resource}`, {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/${resource}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return { list, save, remove };
}

export function useWorkspace() {
  const skills = useResource<Skill>("skills");
  const agents = useResource<Agent>("agents");
  const memories = useResource<Memory>("memories");
  const instructions = useResource<Instruction>("instructions");

  /** Instructions posts require a content hash; compute it client-side. */
  const saveInstruction = async (input: Partial<Instruction> & { id?: string; instruction: string }) => {
    const hash = await sha256Hex(input.instruction);
    return instructions.save.mutateAsync({ ...input, hash } as Partial<Instruction> & { id?: string });
  };

  return { skills, agents, memories, instructions, saveInstruction };
}
