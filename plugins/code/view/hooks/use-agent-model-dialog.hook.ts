import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePluginStore } from "react-pluggable";
import { ApiClient } from "@twodb/shared-frontend";
import type { SessionDto } from "../../shared/types";
import { sessionAgentsQueryKey } from "../lib/api";
import type { SessionAgent } from "./use-agents.hook";
import type { useAgentSwitch } from "./use-agent-switch.hook";

const agentApi = new ApiClient("io.twodb.agent");

export type ProviderInfo = {
	label: string;
	models: { id: string; label: string }[];
};

export function useAgentModelDialog(
	session: SessionDto | null,
	agents: SessionAgent[],
	agentSwitch: ReturnType<typeof useAgentSwitch>,
	hasHistory: boolean,
) {
	const pluginStore = usePluginStore();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [draftAgentId, setDraftAgentId] = useState<string | null>(null);
	const [draftModel, setDraftModel] = useState<string | null>(null);

	const providerInfo = (provider: string): ProviderInfo | undefined =>
		pluginStore.executeFunction("agent::get_provider_info", provider) as
			| ProviderInfo
			| undefined;

	const current = agents.find((agent) => agent.id === session?.agent_id);
	const draftAgent = agents.find(
		(agent) => agent.id === (draftAgentId ?? current?.id),
	);
	const draftInfo = draftAgent ? providerInfo(draftAgent.provider) : undefined;
	const models = draftInfo?.models ?? [];
	const selectedModel = draftModel ?? draftAgent?.model ?? "";

	const mutation = useMutation({
		mutationFn: (input: { agentId: string; model: string }) =>
			agentApi.patch(`/agents/${input.agentId}`, { model: input.model }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sessionAgentsQueryKey });
		},
	});

	const save = async () => {
		if (
			draftAgent &&
			selectedModel.trim() &&
			selectedModel !== (draftAgent.model ?? "")
		) {
			await mutation.mutateAsync({
				agentId: draftAgent.id,
				model: selectedModel.trim(),
			});
		}
		if (draftAgentId && draftAgentId !== current?.id) {
			agentSwitch.requestSwitch(draftAgentId, hasHistory);
		}
		setOpen(false);
		setDraftAgentId(null);
		setDraftModel(null);
	};

	return {
		open,
		openDialog: () => {
			setDraftAgentId(null);
			setDraftModel(null);
			setOpen(true);
		},
		close: () => setOpen(false),
		current,
		currentInfo: current ? providerInfo(current.provider) : undefined,
		agents: agents.filter((agent) => agent.enabled),
		draftAgentId: draftAgentId ?? current?.id ?? "",
		setDraftAgentId: (id: string) => {
			setDraftAgentId(id);
			setDraftModel(null);
		},
		models,
		selectedModel,
		setDraftModel,
		save,
		saving: mutation.isPending || agentSwitch.switching,
		error: mutation.error?.message ?? null,
	};
}
