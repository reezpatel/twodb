import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SettingsLayout } from "@twodb/shared-frontend";
import { Button, Dialog, SideNav } from "@twodb/ui";
import type { AgentDto } from "../../shared/types";
import { useAgents } from "../hooks/use-agents";
import { useAgentMutations } from "../hooks/use-agent-mutations";
import { useAgentsUsageSummary } from "../hooks/use-agent-usage";
import { agentSettingsPath } from "../lib/paths";
import { AgentList } from "./agent-list";
import { AgentUsagePane } from "./agent-usage-pane";
import { agentSettingsStyles } from "./agent-settings.style";

export function AgentsScene() {
	const agents = useAgents();
	const summaries = useAgentsUsageSummary();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [confirming, setConfirming] = useState<AgentDto | null>(null);
	const { remove } = useAgentMutations();

	const selectedAgent = agents.data?.find(
		(a) => a.id === searchParams.get("agent"),
	);
	const selectAgent = (id: string | null) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (id) next.set("agent", id);
				else next.delete("agent");
				return next;
			},
			{ replace: true },
		);
	};

	return (
		<SettingsLayout>
			<style jsx>{agentSettingsStyles}</style>
			<div className="agent-settings">
				<header className="agent-settings__header">
					<div>
						<h3>Agents</h3>
						<p>
							Provider credentials and usage monitoring for AI agents in this
							workspace.
						</p>
					</div>
					<Button size="sm" onClick={() => navigate(agentSettingsPath("/new"))}>
						Add agent
					</Button>
				</header>

				{agents.isPending && (
					<div className="agent-settings__state">Loading…</div>
				)}

				{agents.isError && (
					<div className="agent-settings__state">
						Could not load agents —{" "}
						{agents.error instanceof Error
							? agents.error.message
							: "unknown error"}
					</div>
				)}

				{agents.data &&
					(agents.data.length === 0 ? (
						<div className="agent-settings__state">
							No agents configured yet — add one to get started.
						</div>
					) : (
						<AgentList
							agents={agents.data}
							summaries={summaries.data}
							selectedId={selectedAgent?.id}
							onSelect={(agent) => selectAgent(agent.id)}
						/>
					))}
			</div>

			<SideNav
				open={selectedAgent !== undefined}
				onClose={() => selectAgent(null)}
				from="right"
				width="md"
				title={selectedAgent?.name}
				footer={
					selectedAgent ? (
						<div className="agent-settings__nav-footer">
							<Button
								variant="danger"
								size="sm"
								onClick={() => setConfirming(selectedAgent)}
							>
								Delete
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onClick={() =>
									navigate(agentSettingsPath(`/${selectedAgent.id}/edit`))
								}
							>
								Edit agent
							</Button>
						</div>
					) : undefined
				}
			>
				{selectedAgent && (
					<AgentUsagePane agent={selectedAgent} />
				)}
			</SideNav>

			<Dialog
				open={confirming !== null}
				onClose={() => setConfirming(null)}
				title="Delete agent"
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirming(null)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							disabled={remove.isPending}
							onClick={() => {
								if (!confirming) return;
								remove.mutate(confirming.id, {
									onSettled: () => {
										setConfirming(null);
										selectAgent(null);
									},
								});
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				{confirming && (
					<p className="agent-settings__confirm">
						Delete <strong>{confirming.name}</strong>? Its stored credentials
						and usage history will be removed. This cannot be undone.
					</p>
				)}
			</Dialog>
		</SettingsLayout>
	);
}
