import type { IdentityContext, IdentityWorkspace } from "@twodb/contracts";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { IdentityWrapper } from "../scenes/main";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils";
import { useSignOut } from "./use-sign-out.hook";

export type Context = IdentityContext & {
	isInitialLoading: boolean;
};

export const TwoDbIdentityContext = createContext<Context | null>(null);

export const TwoDbIdentityProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [activeWorkspaceId, setActiveWorkspaceId] = useState<
		string | undefined
	>(() => localStorage.getItem("activeWorkspaceId") ?? undefined);

	const {
		data: sessionData,
		isFetched,
		refetch: refetchSession,
	} = useQuery<{ principal?: { userId: string | null } }>({
		queryKey: ["twodb.identity:session"],
		queryFn: () => apiClient.get("/auth/session"),
	});

	const { data: workspaces, refetch: refetchWorkspaces } = useQuery<{
		workspaces?: IdentityWorkspace[];
	}>({
		queryKey: ["twodb.identity:memberships"],
		queryFn: () => apiClient.get("/me/memberships"),
		enabled: !!sessionData?.principal?.userId,
	});

	const activeWorkspace = useMemo(() => {
		return workspaces?.workspaces?.find((w) => w.id === activeWorkspaceId);
	}, [workspaces, activeWorkspaceId]);

	// Keep the active workspace resolvable: fall back to the first membership
	// and persist, so ApiClient always sends x-workspace-id.
	useEffect(() => {
		const list = workspaces?.workspaces;
		if (!list || list.length === 0) return;
		const valid =
			activeWorkspaceId && list.some((w) => w.id === activeWorkspaceId)
				? activeWorkspaceId
				: list[0].id;
		if (valid !== activeWorkspaceId) {
			localStorage.setItem("activeWorkspaceId", valid);
			setActiveWorkspaceId(valid);
		}
	}, [workspaces, activeWorkspaceId]);

	const signOutMutation = useSignOut();

	const user = useMemo(() => {
		const userId = sessionData?.principal?.userId;
		return userId ? { id: userId, name: "" } : undefined;
	}, [sessionData?.principal?.userId]);

	const ctx: Context = {
		isInitialLoading: !isFetched,
		user,
		workspaces: workspaces?.workspaces,
		activeWorkspace,
		switchWorkspace: (id) => {
			if (id) localStorage.setItem("activeWorkspaceId", id);
			else localStorage.removeItem("activeWorkspaceId");
			setActiveWorkspaceId(id);
		},
		refetch: async () => {
			await refetchSession();
			await refetchWorkspaces();
		},
		signOut: async () => {
			await signOutMutation.mutateAsync();
			localStorage.removeItem("activeWorkspaceId");
			setActiveWorkspaceId(undefined);
			await refetchSession();
			await refetchWorkspaces();
		},
	};

	return (
		<TwoDbIdentityContext.Provider value={ctx}>
			<IdentityWrapper>{children}</IdentityWrapper>
		</TwoDbIdentityContext.Provider>
	);
};

export const useTwoDbIdentity = () => {
	const context = useContext(TwoDbIdentityContext);
	if (!context) {
		throw new Error(
			"useTwoDbIdentity must be used within a TwoDbIdentityProvider",
		);
	}

	return context;
};
