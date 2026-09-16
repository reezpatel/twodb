import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import { ApiError } from "@twodb/shared-frontend";
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

export function useAgentCreate(
	providerId: string,
	onSaved: () => void,
	defaultName = "",
	models?: { id: string; label: string }[],
) {
	const { create } = useAgentMutations();
	const authRef = useRef<Record<string, unknown> | null>(null);

	const nameForm = useForm({
		defaultValues: { name: defaultName, model: models?.[0]?.id ?? "" },
		onSubmit: async ({ value }) => {
			const auth = authRef.current ?? {};
			const { api_key, ...rest } = auth;
			await create.mutateAsync({
				name: value.name.trim(),
				provider: providerId,
				api_key: typeof api_key === "string" ? api_key : undefined,
				config: Object.fromEntries(
					Object.entries(rest).map(([key, val]) => [key, String(val)]),
				),
				model: value.model.trim() || undefined,
				enabled: true,
			});
			onSaved();
		},
	});

	const handleNewAuth = (auth: Record<string, unknown>) => {
		authRef.current = auth;
		nameForm.handleSubmit();
	};

	return {
		nameForm,
		handleNewAuth,
		submitError: apiErrorMessage(create.error),
		isPending: create.isPending,
	};
}
