import { useCallback, useMemo } from "react";
import { useIdentity } from "@twodb/shared-frontend";

type Workspace = { id: string; name: string; orgId: string; orgName: string };

export type WorkspaceGroup = {
	orgId: string;
	orgName: string;
	workspaces: Workspace[];
};

export function useWorkspacePicker() {
	const identity = useIdentity() as {
		workspaces: Workspace[];
		workspaceId?: string;
		switchWorkspace?: (id: string) => void;
	};

	const grouped = useMemo(() => {
		const map = new Map<string, WorkspaceGroup>();
		for (const workspace of identity.workspaces) {
			const group = map.get(workspace.orgId) ?? {
				orgId: workspace.orgId,
				orgName: workspace.orgName,
				workspaces: [],
			};
			group.workspaces.push(workspace);
			map.set(workspace.orgId, group);
		}
		return [...map.values()];
	}, [identity.workspaces]);

	const switchWorkspace = useCallback(
		(id: string) => {
			localStorage.setItem("activeWorkspaceId", id);
			identity.switchWorkspace?.(id);
		},
		[identity.switchWorkspace],
	);

	return {
		grouped,
		workspaces: identity.workspaces,
		activeWorkspaceId: identity.workspaceId,
		switchWorkspace,
	};
}
