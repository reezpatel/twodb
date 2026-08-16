import { useMutation, useQuery } from "@tanstack/react-query";
import { useIdentity } from "@twodb/shared-frontend";
import { apiClient } from "../../utils";

export interface RoleRow {
	id: string;
	key: string;
	name: string;
	isSystem: boolean;
	claims: { claim: string; dangling: boolean }[];
}

export interface Member {
	userId: string;
	name: string;
	email: string | null;
	roleIds: string[];
}

export function useMembersAndRoles() {
	const identity = useIdentity();

	const workspaceId = identity.workspaceId;

	const rolesQuery = useQuery({
		queryKey: ["twodb.identity:workspace:roles", workspaceId],
		queryFn: async () => {
			const data = await apiClient.get<{ roles: RoleRow[]; catalog: string[] }>(
				`/workspace/roles`,
			);
			return {
				roles: data.roles ?? [],
				catalog: data.catalog ?? [],
			};
		},
		enabled: !!workspaceId,
	});

	const membersQuery = useQuery({
		queryKey: ["twodb.identity:workspace:members", workspaceId],
		queryFn: async () => {
			const data = await apiClient.get<{ members: Member[] }>(
				`/workspace/members`,
			);
			return data.members ?? [];
		},
		enabled: !!workspaceId,
	});

	const createRole = useMutation({
		mutationFn: async (vars: { name: string; claims: string[] }) => {
			if (!workspaceId) throw new Error("No active workspace");
			await apiClient.post(`/workspace/roles`, {
				name: vars.name.trim(),
				claims: vars.claims,
			});
		},
		onSuccess: () => rolesQuery.refetch(),
	});

	const canManage = identity.hasClaim("plugin.twodb.identity:role.manage");

	return {
		canManage,
		roles: rolesQuery.data?.roles ?? [],
		catalog: rolesQuery.data?.catalog ?? [],
		members: membersQuery.data ?? [],
		isLoading: rolesQuery.isLoading || membersQuery.isLoading,
		error:
			rolesQuery.error?.message ??
			membersQuery.error?.message ??
			createRole.error?.message ??
			null,
		createRole,
	};
}
