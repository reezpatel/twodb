import { useWorkspacePicker } from "./use-workspace-picker.hook";

export function WorkspacePicker() {
	const { grouped, workspaces, activeWorkspaceId, switchWorkspace } =
		useWorkspacePicker();

	return (
		<nav aria-label="Workspaces" className="workspace-picker">
			<style jsx>{`
				.workspace-picker {
					display: grid;
					gap: var(--space-4);
					padding: var(--space-3);
				}

				.workspace-picker__org {
					display: grid;
					gap: var(--space-2);
				}

				.workspace-picker__org h3 {
					margin: 0;
					font-size: var(--text-xs);
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: var(--tracking-narrow);
					color: var(--ink-3);
				}

				.workspace-picker__org ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: grid;
					gap: var(--space-1);
				}

				.workspace-picker__org button {
					width: 100%;
					text-align: left;
					padding: var(--space-2) var(--space-3);
					border: 0;
					border-radius: var(--r-md);
					background: transparent;
					color: var(--ink);
					font-size: var(--text-sm);
					cursor: pointer;
				}

				.workspace-picker__org button:hover {
					background: var(--bg-field-hover);
				}

				.workspace-picker__org button.is-active {
					background: var(--accent-soft-bg);
					color: var(--accent);
					font-weight: 600;
				}

				.workspace-picker__empty {
					margin: 0;
					color: var(--ink-3);
					font-size: var(--text-sm);
				}
			`}</style>
			{grouped.map((org) => (
				<section key={org.orgId} className="workspace-picker__org">
					<h3>{org.orgName}</h3>
					<ul>
						{org.workspaces.map((workspace) => (
							<li key={workspace.id}>
								<button
									className={
										activeWorkspaceId === workspace.id ? "is-active" : ""
									}
									onClick={() => void switchWorkspace?.(workspace.id)}
									aria-current={
										activeWorkspaceId === workspace.id ? "true" : undefined
									}
								>
									{workspace.name}
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
			{workspaces.length === 0 && (
				<p className="workspace-picker__empty">No workspaces yet.</p>
			)}
		</nav>
	);
}
