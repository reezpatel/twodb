import { SettingsLayout } from "@twodb/shared-frontend";
import { Button } from "@twodb/ui";
import { useNodesScene } from "../hooks/use-nodes-scene.hook";
import { apiErrorMessage } from "../lib/errors";
import {
	formatAge,
	formatBytes,
	formatLoadavg,
	memoryUsed,
} from "../lib/format";
import type { FleetNode } from "../lib/types";
import { NodeCreateDialog } from "./node-create-dialog";
import { NodeDetailDrawer } from "./node-detail-drawer";
import { nodesSceneStyles } from "./nodes-scene.style";

function NodeRow({
	node,
	selected,
	onSelect,
}: {
	node: FleetNode;
	selected: boolean;
	onSelect: () => void;
}) {
	const hb = node.last_heartbeat ?? null;
	const used = hb ? memoryUsed(hb.memoryTotal, hb.memoryFree) : 0;

	return (
		<tr
			className={`node-row${selected ? " node-row--selected" : ""}`}
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
		>
			<td className="node-cell node-cell--status">
				<span className={`node-dot node-dot--${node.status}`} />
				<span className="node-row__status-text">{node.status}</span>
			</td>
			<td className="node-cell">
				<div className="node-row__name">{node.name}</div>
				<div className="node-cue">{node.id}</div>
			</td>
			<td className="node-cell">
				<div className="node-row__host">{node.hostname ?? "—"}</div>
				<div className="node-cue">
					{[node.platform, node.arch].filter(Boolean).join(" · ") || "unknown"}
				</div>
			</td>
			<td className="node-cell node-cell--mono">{node.node_version ?? "—"}</td>
			<td className="node-cell node-cell--now">
				{formatAge(node.last_seen_at)}
			</td>
			<td className="node-cell">
				{hb ? (
					<div className="node-row__resources">
						<div>
							{hb.cpus} cpus · load {formatLoadavg(hb.loadavg.slice(0, 1))} ·{" "}
							{formatBytes(used)} / {formatBytes(hb.memoryTotal)} mem
						</div>
						<div className="node-cue">
							{hb.activeJobs} active {hb.activeJobs === 1 ? "job" : "jobs"} ·{" "}
							{hb.status}
						</div>
					</div>
				) : (
					<span className="node-row__muted">—</span>
				)}
			</td>
		</tr>
	);
}

export function NodesScene() {
	const { nodes, selectedId, select, createOpen, setCreateOpen, onlineCount } =
		useNodesScene();

	return (
		<SettingsLayout>
			<style jsx>{nodesSceneStyles}</style>
			<div className="node-settings">
				<div className="node-settings__inner">
					<header className="node-settings__header">
						<div>
							<h3 className="node-settings__title">Nodes</h3>
							<p className="node-settings__subtitle">
								{nodes.data
									? `${onlineCount} of ${nodes.data.length} online · heartbeats stream in over the gateway`
									: "Child agents that connect to this workspace over the gateway"}
							</p>
						</div>
						<div className="node-settings__actions">
							<Button size="sm" onClick={() => setCreateOpen(true)}>
								Add node
							</Button>
						</div>
					</header>

					{nodes.isPending && (
						<div className="node-settings__state">Loading nodes…</div>
					)}

					{nodes.isError && (
						<div className="node-settings__state">
							<span>
								Could not load nodes —{" "}
								{apiErrorMessage(nodes.error) ?? "unknown error"}
							</span>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => nodes.refetch()}
							>
								Retry
							</Button>
						</div>
					)}

					{nodes.data &&
						(nodes.data.length === 0 ? (
							<div className="node-settings__state">
								<span>
									No nodes yet — add one and connect it with its secret to see
									heartbeats here.
								</span>
								<Button size="sm" onClick={() => setCreateOpen(true)}>
									Add node
								</Button>
							</div>
						) : (
							<div className="node-table-wrap">
								<div className="node-table-scroll">
									<table className="node-table">
										<thead className="node-thead">
											<tr>
												<th className="node-th">Status</th>
												<th className="node-th">Name</th>
												<th className="node-th">Host</th>
												<th className="node-th">Version</th>
												<th className="node-th">Last seen</th>
												<th className="node-th">Resources</th>
											</tr>
										</thead>
										<tbody>
											{nodes.data.map((node) => (
												<NodeRow
													key={node.id}
													node={node}
													selected={node.id === selectedId}
													onSelect={() => select(node.id)}
												/>
											))}
										</tbody>
									</table>
								</div>
							</div>
						))}
				</div>

				<NodeDetailDrawer nodeId={selectedId} onClose={() => select(null)} />
				<NodeCreateDialog
					open={createOpen}
					onClose={() => setCreateOpen(false)}
				/>
			</div>
		</SettingsLayout>
	);
}
