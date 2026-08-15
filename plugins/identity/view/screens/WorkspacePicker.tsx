import { useIdentity } from "@twodb/shared-frontend";

export function WorkspacePicker() {
	const identity = useIdentity();
	const groupedByOrg = new Map<string, { orgId: string; orgName: string; ws: typeof identity.workspaces }>();
	for (const w of identity.workspaces) {
		const list = groupedByOrg.get(w.orgId) ?? { orgId: w.orgId, orgName: w.orgName, ws: [] };
		list.ws = [...list.ws, w];
		groupedByOrg.set(w.orgId, list);
	}
	return (
		<nav aria-label="Workspaces">
			{[...groupedByOrg.values()].map((org) => (
				<section key={org.orgId}>
					<h3>{org.orgName}</h3>
					<ul>
						{org.ws.map((w) => (
							<li key={w.id}>
								<button
									onClick={() => void identity.switchWorkspace(w.id)}
									aria-current={
										identity.workspaceId === w.id ? "true" : undefined
									}
								>
									{w.name}
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
			{identity.workspaces.length === 0 && (
				<p>No workspaces yet.</p>
			)}
		</nav>
	);
}
