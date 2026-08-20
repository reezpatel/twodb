import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@twodb/shared-frontend";
import { useTwoDbIdentity } from "../../provider/identity-provider";
import { apiClient } from "../../utils";

type Step = "org" | "workspace";

function serverError(error: unknown, fallback: string): string {
	if (error instanceof ApiError) {
		try {
			const parsed = JSON.parse(error.body) as { error?: string };
			return parsed.error ?? fallback;
		} catch {
			return fallback;
		}
	}
	if (error instanceof Error) return error.message;
	return fallback;
}

const slugPattern = /^[a-z0-9-]+$/;

export function useWorkspaceCreator() {
	const { refetch } = useTwoDbIdentity();
	const [step, setStep] = useState<Step>("org");
	const [orgId, setOrgId] = useState<string | null>(null);
	const [orgError, setOrgError] = useState<string | null>(null);
	const [workspaceError, setWorkspaceError] = useState<string | null>(null);

	const orgForm = useForm({
		defaultValues: { name: "", slug: "" },
		onSubmit: async ({ value }) => {
			setOrgError(null);
			await createOrg.mutateAsync({
				name: value.name.trim(),
				slug: value.slug.trim(),
			});
		},
	});

	const workspaceForm = useForm({
		defaultValues: { name: "", slug: "" },
		onSubmit: async ({ value }) => {
			setWorkspaceError(null);
			await createWorkspace.mutateAsync({
				name: value.name.trim(),
				slug: value.slug.trim(),
			});
		},
	});

	const createOrg = useMutation({
		mutationFn: async (vars: { name: string; slug: string }) => {
			const data = await apiClient.post<{
				orgId: string;
				defaultWorkspaceId?: string;
			}>("/orgs", vars);
			return data;
		},
		onSuccess: async (data, vars) => {
			if (data.defaultWorkspaceId) {
				await refetch();
				window.location.assign("/");
				return;
			}
			setOrgId(data.orgId);
			workspaceForm.setFieldValue("name", `${vars.name.trim()} HQ`);
			workspaceForm.setFieldValue("slug", `${vars.slug.trim()}-hq`);
			setStep("workspace");
		},
		onError: (err) => {
			setOrgError(serverError(err, "Couldn't create that organization."));
		},
	});

	const createWorkspace = useMutation({
		mutationFn: async (vars: { name: string; slug: string }) => {
			const { orgs } = await apiClient.get<{ orgs: { id: string }[] }>(
				"/me/memberships",
			);
			const targetOrgId = orgId ?? orgs[0]?.id;
			if (!targetOrgId) throw new Error("Couldn't find your organization.");
			const created = await apiClient.post<{ workspaceId: string }>(
				"/workspaces",
				{
					orgId: targetOrgId,
					name: vars.name,
					slug: vars.slug,
				},
			);
			return { ...created, orgId: targetOrgId };
		},
		onSuccess: async () => {
			await refetch();
			window.location.assign("/");
		},
		onError: (err) => {
			setWorkspaceError(serverError(err, "Couldn't create that workspace."));
		},
	});

	const isPending = createOrg.isPending || createWorkspace.isPending;

	return {
		step,
		orgForm,
		workspaceForm,
		isPending,
		orgError,
		workspaceError,
		slugPattern,
	};
}
