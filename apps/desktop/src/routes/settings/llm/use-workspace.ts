import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Skill {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  name: string;
  description: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  provider: string;
  model: string;
  description: string | null;
  instruction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  name: string;
  url: string;
  transport: string;
  headers: Record<string, string>;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type MemoryScope = "workspace" | "project" | "session";

export interface Memory {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  scopeId: string | null;
  scope: MemoryScope;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Instruction {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
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
