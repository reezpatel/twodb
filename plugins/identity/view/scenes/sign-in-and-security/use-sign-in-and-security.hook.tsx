import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@twodb/shared-frontend";
import { apiClient } from "../../utils";

export interface MethodRow {
	id: string;
	method: string;
	enabled: boolean;
}

export function useSignInAndSecurity() {
	const identity = useIdentity();
	const queryClient = useQueryClient();
	const methodsQueryKey = ["twodb.identity:me:auth-methods"];

	const methodsQuery = useQuery({
		queryKey: methodsQueryKey,
		queryFn: async () => {
			const data = await apiClient.get<{ methods: MethodRow[] }>(
				"/me/auth-methods",
			);
			return data.methods ?? [];
		},
	});

	const toggle = useMutation({
		mutationFn: async (vars: { id: string; enabled: boolean }) => {
			await apiClient.patch(`/me/auth-methods/${vars.id}`, {
				enabled: vars.enabled,
			});
			return vars;
		},
		onSuccess: (vars) => {
			queryClient.setQueryData<MethodRow[]>(methodsQueryKey, (prev) =>
				prev?.map((m) =>
					m.id === vars.id ? { ...m, enabled: vars.enabled } : m,
				),
			);
		},
	});

	const resendVerify = useMutation({
		mutationFn: async () => {
			await apiClient.post("/auth/verify", {});
		},
	});

	const signOutEverywhere = useMutation({
		mutationFn: async () => {
			await apiClient.post("/auth/logout", {});
		},
		onSuccess: () => {
			window.location.assign("/sign-in");
		},
	});

	const error =
		methodsQuery.error?.message ??
		toggle.error?.message ??
		resendVerify.error?.message ??
		signOutEverywhere.error?.message ??
		null;

	return {
		userName: identity.userName,
		userId: identity.userId,
		methods: methodsQuery.data ?? [],
		isLoading: methodsQuery.isLoading,
		error,
		toggle,
		resendVerify,
		signOutEverywhere,
	};
}
