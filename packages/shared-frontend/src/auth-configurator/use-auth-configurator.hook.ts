import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiClient, ApiError } from "../api";
import type { AuthConfiguratorSpec } from "./spec";

const agentApi = new ApiClient("io.twodb.agent");

function verifyErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		try {
			return (JSON.parse(error.body) as { error?: string }).error ?? error.body;
		} catch {
			return error.body;
		}
	}
	return error instanceof Error ? error.message : String(error);
}

export type VerifyState = {
	pending: boolean;
	ok: string | null;
	error: string | null;
	run: () => void;
};

export function useAuthConfigurator(
	spec: AuthConfiguratorSpec,
	onNewAuth: (auth: Record<string, unknown>) => void,
) {
	const [oauthOpen, setOauthOpen] = useState(false);

	const defaultValues: Record<string, string> = {};
	if (spec.apiKey) defaultValues.api_key = "";
	for (const field of spec.fields ?? []) defaultValues[field.key] = "";
	for (const field of spec.oauth?.fields ?? []) defaultValues[field.key] = "";

	const form = useForm({
		defaultValues,
		onSubmit: async ({ value, formApi }) => {
			const auth: Record<string, unknown> = {};
			for (const [key, raw] of Object.entries(value)) {
				const trimmed = raw.trim();
				if (trimmed) auth[key] = trimmed;
			}
			onNewAuth(auth);
			formApi.reset();
		},
	});

	const verify = useMutation({
		mutationFn: async () => {
			const values = form.state.values;
			const config: Record<string, string> = {};
			for (const field of [
				...(spec.fields ?? []),
				...(spec.oauth?.fields ?? []),
			]) {
				const raw = (values[field.key] ?? "").trim();
				if (raw) config[field.key] = raw;
			}
			const apiKey = (values.api_key ?? "").trim();
			return agentApi.post<{ groups: string[] }>("/agents/verify", {
				provider: spec.providerId,
				api_key: apiKey || undefined,
				config,
			});
		},
	});

	const verifyState: VerifyState = {
		pending: verify.isPending,
		ok: verify.data
			? `Connected${verify.data.groups[0] ? ` — ${verify.data.groups[0]}` : ""}`
			: null,
		error: verify.error ? verifyErrorMessage(verify.error) : null,
		run: () => verify.mutate(),
	};

	const revealOauth = () => setOauthOpen(true);

	return { form, verifyState, oauthOpen, revealOauth };
}
