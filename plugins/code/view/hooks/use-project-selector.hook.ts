import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TypeaheadItem } from "@twodb/ui";
import type {
	FolderMatchDto,
	SessionDto,
	SessionNodeDto,
} from "../../shared/types";
import {
	codeApi,
	folderSearchQueryKey,
	sessionAgentsQueryKey,
	sessionNodesQueryKey,
	sessionsQueryKey,
} from "../lib/api";

const SUGGEST_DELAY_MS = 250;

const toFolderItem = (folder: FolderMatchDto): TypeaheadItem => ({
	id: folder.relative_path,
	label: folder.relative_path,
	description: folder.path,
});

type AgentOption = {
	id: string;
	name: string;
	provider: string;
	model: string | null;
	enabled: boolean;
};

export function useProjectSelector(onCreated?: () => void) {
	const queryClient = useQueryClient();
	const [nodeId, setNodeId] = useState("");
	const [agentId, setAgentId] = useState("");
	const [folderQuery, setFolderQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedFolder, setSelectedFolder] = useState<TypeaheadItem | null>(
		null,
	);

	useEffect(() => {
		const timer = setTimeout(
			() => setDebouncedQuery(folderQuery.trim()),
			SUGGEST_DELAY_MS,
		);
		return () => clearTimeout(timer);
	}, [folderQuery]);

	const nodesQuery = useQuery({
		queryKey: sessionNodesQueryKey,
		queryFn: async () =>
			(await codeApi.get<{ nodes: SessionNodeDto[] }>("/nodes")).nodes,
	});

	const agentsQuery = useQuery({
		queryKey: sessionAgentsQueryKey,
		queryFn: async () =>
			(await codeApi.get<{ agents: AgentOption[] }>("/agents")).agents,
	});

	const foldersQuery = useQuery({
		queryKey: folderSearchQueryKey(nodeId, debouncedQuery),
		enabled: Boolean(nodeId) && debouncedQuery.length > 0,
		queryFn: async () =>
			(
				await codeApi.get<{ folders: FolderMatchDto[] }>(
					`/folders?node_id=${encodeURIComponent(nodeId)}&q=${encodeURIComponent(debouncedQuery)}`,
				)
			).folders,
	});

	const create = useMutation({
		mutationFn: (input: {
			node_id: string;
			cwd: string;
			title?: string;
			agent_id?: string;
		}) => codeApi.post<{ session: SessionDto }>("/sessions", input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
			onCreated?.();
		},
	});

	const changeFolderQuery = useCallback((query: string) => {
		setFolderQuery(query);
		setSelectedFolder(null);
	}, []);

	const selectFolder = useCallback((folder: TypeaheadItem | null) => {
		setSelectedFolder(folder);
		if (!folder) return;
		// Path browsing ("/mnt/…") keeps the slash flow so selection dives deeper.
		setFolderQuery((previous) =>
			previous.startsWith("/") ? `/${folder.label}/` : folder.label,
		);
	}, []);

	const reset = useCallback(() => {
		setNodeId("");
		setAgentId("");
		setFolderQuery("");
		setDebouncedQuery("");
		setSelectedFolder(null);
	}, []);

	const nodes = (nodesQuery.data ?? []).map((node) => ({
		value: node.id,
		label: node.status === "online" ? node.name : `${node.name} (offline)`,
	}));
	const agents = (agentsQuery.data ?? [])
		.filter((agent) => agent.enabled)
		.map((agent) => ({
			value: agent.id,
			label: agent.model ? `${agent.name} · ${agent.model}` : agent.name,
		}));
	const folderItems = (foldersQuery.data ?? []).map(toFolderItem);

	const submit = useCallback(() => {
		if (!nodeId || !selectedFolder) return;
		// Title omitted on purpose — the service generates a memorable name.
		create.mutate({
			node_id: nodeId,
			cwd: selectedFolder.id,
			agent_id: agentId || undefined,
		});
	}, [nodeId, agentId, selectedFolder, create.mutate]);

	return {
		nodes,
		nodesLoading: nodesQuery.isLoading,
		nodeId,
		setNodeId,
		agents,
		agentsLoading: agentsQuery.isLoading,
		agentId,
		setAgentId,
		folderQuery,
		setFolderQuery: changeFolderQuery,
		folderItems,
		folderLoading: foldersQuery.isFetching,
		selectedFolder,
		selectFolder,
		reset,
		submit,
		creating: create.isPending,
		createError: create.error?.message ?? null,
	};
}
