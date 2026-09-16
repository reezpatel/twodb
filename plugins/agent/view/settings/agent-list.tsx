import type { AgentDto, AgentUsageSnapshotDto } from "../../shared/types";
import { getProviderConfigurator } from "../lib/provider-registry";
import { agentListStyles } from "./agent-list.style";
import { UsageMark } from "./usage-mark";

type AgentListProps = {
	agents: AgentDto[];
	summaries?: Record<string, AgentUsageSnapshotDto[]>;
	selectedId?: string;
	onSelect: (agent: AgentDto) => void;
};

const WINDOW_ORDER: Record<AgentUsageSnapshotDto["window_type"], number> = {
	balance: 0,
	hourly: 1,
	"5h": 2,
	daily: 3,
	weekly: 4,
	monthly: 5,
};

export function AgentList({
	agents,
	summaries,
	selectedId,
	onSelect,
}: AgentListProps) {
	return (
		<ul className="agent-list">
			<style jsx>{agentListStyles}</style>
			{agents.map((agent) => {
				const providerLabel =
					getProviderConfigurator(agent.provider)?.label ?? agent.provider;
				const windows = (summaries?.[agent.id] ?? [])
					.slice()
					.sort(
						(a, b) => WINDOW_ORDER[a.window_type] - WINDOW_ORDER[b.window_type],
					);
				const smallest = windows[0];
				const largest =
					windows.length > 1 ? windows[windows.length - 1] : undefined;
				return (
					<li key={agent.id}>
						<div
							role="button"
							tabIndex={0}
							className={`agent-list__row${
								agent.id === selectedId ? " agent-list__row--selected" : ""
							}`}
							onClick={() => onSelect(agent)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") onSelect(agent);
							}}
						>
							<div className="agent-list__title">
								<span className="agent-list__name">{agent.name}</span>
								<span className="tw-cue agent-list__provider">
									{providerLabel}
								</span>
							</div>
							{agent.usage_last_error ? (
								<div className="agent-list__usage">
									<span
										className="agent-list__meta-error"
										title={agent.usage_last_error}
									>
										{agent.usage_last_error}
									</span>
								</div>
							) : smallest ? (
								<div className="agent-list__usage">
									<UsageMark snapshot={smallest} />
									{largest && (
										<span className="agent-list__meta-separator"></span>
									)}
									{largest && <UsageMark snapshot={largest} />}
								</div>
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
