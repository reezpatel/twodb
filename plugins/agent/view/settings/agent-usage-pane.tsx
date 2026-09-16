import { Button, Progress } from "@twodb/ui";
import type { AgentProviderType } from "../../shared/providers";
import type { AgentDto, AgentUsageSnapshotDto } from "../../shared/types";
import { useAgentUsage, useRefreshAgentUsage } from "../hooks/use-agent-usage";
import { getProviderConfigurator } from "../lib/provider-registry";
import { agentUsagePaneStyles } from "./agent-usage-pane.style";

type AgentUsagePaneProps = {
	agent: AgentDto;
	template?: AgentProviderType;
};

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const relativePast = (iso: string): string => {
	const delta = Date.now() - Date.parse(iso);
	if (!Number.isFinite(delta) || delta < MIN) return "just now";
	if (delta < HOUR) return `${Math.floor(delta / MIN)} min ago`;
	if (delta < DAY) return `${Math.floor(delta / HOUR)} h ago`;
	return `${Math.floor(delta / DAY)} d ago`;
};

const relativeFuture = (iso: string | null): string => {
	if (!iso) return "—";
	const delta = Date.parse(iso) - Date.now();
	if (!Number.isFinite(delta)) return "—";
	if (delta <= 0) return "now";
	if (delta < HOUR) return `in ${Math.max(1, Math.floor(delta / MIN))} min`;
	if (delta < DAY) return `in ${Math.floor(delta / HOUR)} h`;
	return `in ${Math.floor(delta / DAY)} d`;
};

const daysUntil = (iso: string): number => (Date.parse(iso) - Date.now()) / DAY;

const windowLabel = (type: AgentUsageSnapshotDto["window_type"]): string =>
	type === "5h" ? "5-hour" : type;

const formatMoney = (value: number): string =>
	value.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

const progressTone = (pct: number): "rose" | "warning" | "accent" =>
	pct >= 90 ? "rose" : pct >= 70 ? "warning" : "accent";

const UsageWindow = ({ snapshot }: { snapshot: AgentUsageSnapshotDto }) => {
	const isBalance = snapshot.window_type === "balance";
	const pct = snapshot.total > 0 ? (snapshot.used / snapshot.total) * 100 : 0;
	const sessionExpiringSoon =
		isBalance && snapshot.reset_at !== null && daysUntil(snapshot.reset_at) < 7;

	return (
		<section className="usage-window">
			<header className="usage-window__head">
				<span className="tw-cue">{windowLabel(snapshot.window_type)}</span>
				<span className="usage-window__group">{snapshot.group_label}</span>
			</header>

			{isBalance ? (
				<div className="usage-window__readout">
					<span className="usage-window__big tw-tnum">
						${formatMoney(snapshot.total)}
					</span>
					<span className="usage-window__sub">remaining balance</span>
				</div>
			) : (
				<div className="usage-window__readout">
					<span className="usage-window__big tw-tnum">
						{snapshot.unit === "%"
							? `${snapshot.used.toLocaleString()}%`
							: snapshot.used.toLocaleString()}
					</span>
					<span className="usage-window__sub">
						{snapshot.unit === "%"
							? `used · ${Math.max(0, snapshot.total - snapshot.used).toLocaleString()}% left`
							: `of ${snapshot.total.toLocaleString()} ${snapshot.unit}`}
					</span>
					<Progress
						value={pct}
						tone={progressTone(pct)}
						aria-label={`${snapshot.group_label} ${windowLabel(snapshot.window_type)} usage`}
					/>
				</div>
			)}

			{sessionExpiringSoon && (
				<div className="usage-window__warn">
					Sign-in session expires {relativeFuture(snapshot.reset_at)} — update
					the session cookie under Edit to keep monitoring alive.
				</div>
			)}

			<footer className="usage-window__meta">
				<span>
					{isBalance ? "session expires" : "resets"}{" "}
					{relativeFuture(snapshot.reset_at)}
				</span>
			</footer>
		</section>
	);
};

export function AgentUsagePane({ agent, template }: AgentUsagePaneProps) {
	const usage = useAgentUsage(agent.id);
	const refresh = useRefreshAgentUsage(agent.id);

	const registered = getProviderConfigurator(agent.provider);
	const providerLabel = template?.label ?? registered?.label ?? agent.provider;
	const supportsUsage = template?.usage.supported ?? registered?.usage ?? false;

	const lastError = usage.data?.last_error ?? agent.usage_last_error;
	const lastFetched =
		usage.data?.last_fetched_at ?? agent.usage_last_fetched_at;

	return (
		<div className="usage">
			<style jsx>{agentUsagePaneStyles}</style>

			<div className="usage__status">
				<span
					className={`usage__dot${lastError ? " usage__dot--error" : ""}`}
					aria-hidden
				/>
				<span className="usage__status-text">
					{providerLabel}
					{" · "}
					{lastFetched
						? `checked ${relativePast(lastFetched)}`
						: "never checked"}
				</span>
				{supportsUsage && (
					<Button
						size="sm"
						disabled={refresh.isPending}
						onClick={() => refresh.mutate()}
					>
						{refresh.isPending ? "Refreshing…" : "Refresh"}
					</Button>
				)}
			</div>

			{lastError && (
				<div className="usage__error" role="alert">
					<span className="tw-cue usage__error-title">check failed</span>
					<p className="usage__error-body">{lastError}</p>
					<p className="usage__error-hint">
						Update the credentials under Edit, then Refresh to retry.
					</p>
				</div>
			)}

			{usage.isPending && <div className="usage__state">Checking usage…</div>}

			{usage.isError && (
				<div className="usage__state">
					Could not load usage —{" "}
					{usage.error instanceof Error ? usage.error.message : "unknown"}
				</div>
			)}

			{usage.data &&
				usage.data.snapshots.length === 0 &&
				!usage.data.last_error && (
					<div className="usage__state">
						{supportsUsage
							? "No usage data yet — Refresh collects the first snapshot."
							: "This provider doesn't report usage."}
					</div>
				)}

			{usage.data?.snapshots.map((snapshot) => (
				<UsageWindow key={snapshot.id} snapshot={snapshot} />
			))}
		</div>
	);
}
