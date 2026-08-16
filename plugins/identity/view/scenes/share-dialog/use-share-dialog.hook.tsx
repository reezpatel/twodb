import { useMutation, useQuery } from "@tanstack/react-query";
import { useIdentity, type ShareDialogProps } from "@twodb/shared-frontend";
import { apiClient } from "../../utils";

export interface GrantRow {
	id: string;
	user: { id: string; name: string; email: string | null };
	claims: string[];
}

const readableClaim = "plugin.twodb.notes:note.read";
const editableClaim = "plugin.twodb.notes:note.edit";

export function useShareDialog(props: ShareDialogProps) {
	const identity = useIdentity();

	const grantsQuery = useQuery({
		queryKey: [
			"twodb.identity:grants",
			props.workspaceId,
			props.entityType,
			props.entityId,
		],
		queryFn: async () => {
			const data = await apiClient.get<{ grants: GrantRow[] }>(
				`/grants?entityType=${encodeURIComponent(props.entityType)}&entityId=${encodeURIComponent(props.entityId)}`,
			);
			return data.grants ?? [];
		},
		enabled: !!identity.workspaceId,
	});

	const invite = useMutation({
		mutationFn: async (vars: { email: string; level: "read" | "edit" }) => {
			if (!identity.workspaceId) throw new Error("No active workspace");

			const claim = vars.level === "edit" ? editableClaim : readableClaim;
			const inviteRes = await apiClient.post<{ userId: string }>(
				`/workspace/members`,
				{
					identifier: vars.email.trim(),
					role: "guest",
				},
			);

			await apiClient.post("/grants", {
				entityType: props.entityType,
				entityId: props.entityId,
				userId: inviteRes.userId,
				claims: [claim],
			});
		},
		onSuccess: () => grantsQuery.refetch(),
	});

	const revoke = useMutation({
		mutationFn: async (grantId: string) => {
			await apiClient.del(`/grants/${grantId}`);
		},
		onSuccess: () => grantsQuery.refetch(),
	});

	const error =
		grantsQuery.error?.message ??
		invite.error?.message ??
		revoke.error?.message ??
		null;

	return {
		grants: grantsQuery.data ?? [],
		isLoading: grantsQuery.isLoading,
		invite,
		revoke,
		error,
		editableClaim,
	};
}
