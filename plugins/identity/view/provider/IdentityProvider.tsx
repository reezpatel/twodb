import type { IdentityContext, IdentityWorkspace } from "@twodb/contracts";
import { createContext, useContext, useMemo, useState } from "react";
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
	>();

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
		switchWorkspace: setActiveWorkspaceId,
		refetch: async () => {
			await refetchSession();
			await refetchWorkspaces();
		},
		signOut: async () => {
			await signOutMutation.mutateAsync();
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
