import { useForm } from "@tanstack/react-form";
import { ApiError } from "@twodb/shared-frontend";
import type { AgentDto } from "../../shared/types";
import { useAgentMutations } from "./use-agent-mutations";

function apiErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		try {
			return (JSON.parse(error.body) as { error?: string }).error ?? error.body;
		} catch {
			return error.body;
		}
	}
	return error instanceof Error ? error.message : undefined;
}

export function useAgentEdit(
	agent: AgentDto,
	onSaved: () => void,
	models?: { id: string; label: string }[],
) {
	const { update } = useAgentMutations();

	const form = useForm({
		defaultValues: {
			name: agent.name,
			enabled: agent.enabled,
			model: agent.model ?? models?.[0]?.id ?? "",
		},
		onSubmit: async ({ value }) => {
			await update.mutateAsync({
				id: agent.id,
				name: value.name.trim(),
				enabled: value.enabled,
				model: value.model.trim() || null,
			});
			onSaved();
		},
	});

	return {
		form,
		isPending: update.isPending,
		submitError: apiErrorMessage(update.error),
	};
}
