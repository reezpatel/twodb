import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nodeRepo } from "../lib/api";
import type { CreateNodeRequest } from "../../shared/api";

export function useNodesData() {
  const queryClient = useQueryClient();

  const nodesQuery = useQuery({
    queryKey: ["node", "nodes"],
    queryFn: () => nodeRepo.listNodes(),
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["node"] });

  const createNode = useMutation({
    mutationFn: (body: CreateNodeRequest) => nodeRepo.createNode(body),
    onSuccess: invalidate,
  });

  const removeNode = useMutation({
    mutationFn: (id: string) => nodeRepo.deleteNode(id),
    onSuccess: invalidate,
  });

  const rotateToken = useMutation({
    mutationFn: (id: string) => nodeRepo.rotateToken(id),
  });

  return { nodesQuery, createNode, removeNode, rotateToken };
}
