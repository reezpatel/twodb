import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Badge, Button, Input, Progress, SideNav } from "@twodb/ui";
import type { NodeSecretDto } from "../../shared/types";
import { useNodeDetailDrawer } from "../hooks/use-node-detail-drawer.hook";
import { useNodeMutations } from "../hooks/use-node-mutations.hook";
import {
	formatAge,
	formatBytes,
	formatLoadavg,
	formatUptime,
	memoryUsed,
} from "../lib/format";
import { apiErrorMessage } from "../lib/errors";
import { required } from "../lib/validators";
import type { FleetNode, RevealedSecret } from "../lib/types";
import { SecretReveal } from "./secret-reveal";
import { nodeDrawerStyles } from "./node-detail-drawer.style";

type DrawerApi = ReturnType<typeof useNodeDetailDrawer>;
type RemoveMutation = ReturnType<typeof useNodeMutations>["remove"];

type NodeDetailDrawerProps = {
	nodeId: string | null;
	onClose: () => void;
};

function RenameForm({ node }: { node: FleetNode }) {
	const { rename } = useNodeMutations();

	const form = useForm({
		defaultValues: { name: node.name },
		onSubmit: async ({ value }) => {
			const result = await rename.mutateAsync({
				id: node.id,
				name: value.name.trim(),
			});
			form.reset({ name: result.node.name });
		},
	});

	return (
		<form
			className="node-drawer__rename"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.Field name="name" validators={required("Name is required")}>
				{(field) => (
					<div className="node-drawer__rename-field">
						<Input
							label="Name"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							error={field.state.meta.errors[0]?.toString()}
						/>
					</div>
				)}
			</form.Field>
			<form.Subscribe selector={(s) => s.isSubmitting}>
				{(isSubmitting) => (
					<Button
						variant="secondary"
						size="sm"
						type="submit"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Saving…" : "Rename"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

function DetailsList({ node }: { node: FleetNode }) {
	const hb = node.last_heartbeat ?? null;
	const used = hb ? memoryUsed(hb.memoryTotal, hb.memoryFree) : 0;
	const memPct = hb && hb.memoryTotal > 0 ? (used / hb.memoryTotal) * 100 : 0;
	const host = [node.platform, node.arch].filter(Boolean).join(" · ");

	return (
		<dl className="node-kv">
			<div className="node-kv__row">
				<dt>Host</dt>
				<dd>{node.hostname ?? "—"}</dd>
			</div>
			<div className="node-kv__row">
				<dt>Platform</dt>
				<dd>{host || "—"}</dd>
			</div>
			<div className="node-kv__row">
				<dt>Node version</dt>
				<dd className="node-kv__mono">{node.node_version ?? "—"}</dd>
			</div>
			<div className="node-kv__row">
				<dt>Created</dt>
				<dd>{formatAge(node.created_at)}</dd>
			</div>
			{hb ? (
				<>
					<div className="node-kv__row">
						<dt>CPUs</dt>
						<dd>{hb.cpus}</dd>
					</div>
					<div className="node-kv__row">
						<dt>Load avg</dt>
						<dd>{formatLoadavg(hb.loadavg)}</dd>
					</div>
					<div className="node-kv__row">
						<dt>Memory</dt>
						<dd>
							<div className="node-kv__mem">
								<Progress
									value={memPct}
									aria-label="Memory used"
									tone={memPct > 90 ? "warning" : "accent"}
								/>
								<span>
									{formatBytes(used)} / {formatBytes(hb.memoryTotal)}
								</span>
							</div>
						</dd>
					</div>
					<div className="node-kv__row">
						<dt>System uptime</dt>
						<dd>{formatUptime(hb.systemUptimeSec)}</dd>
					</div>
					<div className="node-kv__row">
						<dt>Agent uptime</dt>
						<dd>{formatUptime(hb.processUptimeSec)}</dd>
					</div>
					<div className="node-kv__row">
						<dt>Active jobs</dt>
						<dd>{hb.activeJobs}</dd>
					</div>
					<div className="node-kv__row">
						<dt>State</dt>
						<dd>
							{hb.status === "busy" ? (
								<Badge tone="warning" size="sm">
									busy
								</Badge>
							) : (
								<Badge tone="go" size="sm">
									idle
								</Badge>
							)}
						</dd>
					</div>
				</>
			) : null}
		</dl>
	);
}

function NewSecretForm({
	nodeId,
	onCreated,
	onCancel,
}: {
	nodeId: string;
	onCreated: (revealed: RevealedSecret) => void;
	onCancel: () => void;
}) {
	const { createSecret } = useNodeMutations();

	const form = useForm({
		defaultValues: { label: "" },
		onSubmit: async ({ value }) => {
			const revealed = await createSecret.mutateAsync({
				nodeId,
				label: value.label.trim() || undefined,
			});
			form.reset();
			onCreated(revealed);
		},
	});

	return (
		<form
			className="node-drawer__new-secret"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.Field name="label">
				{(field) => (
					<div className="node-drawer__new-secret-field">
						<Input
							label="Label"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							placeholder="optional — e.g. laptop"
						/>
					</div>
				)}
			</form.Field>
			<form.Subscribe selector={(s) => s.isSubmitting}>
				{(isSubmitting) => (
					<Button size="sm" type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Generating…" : "Generate"}
					</Button>
				)}
			</form.Subscribe>
			<Button variant="ghost" size="sm" type="button" onClick={onCancel}>
				Cancel
			</Button>
		</form>
	);
}

function SecretsSection({
	nodeId,
	secrets,
	drawer,
}: {
	nodeId: string;
	secrets: NodeSecretDto[];
	drawer: DrawerApi;
}) {
	const { revokeSecret, revealed, setRevealed } = drawer;
	const [adding, setAdding] = useState(false);

	return (
		<>
			{secrets.length === 0 && !adding && (
				<p className="node-drawer__muted">
					No secrets — generate one so this node can connect.
				</p>
			)}
			{secrets.length > 0 && (
				<ul className="node-secrets">
					{secrets.map((secret) => (
						<li
							key={secret.id}
							className={`node-secret-item${secret.revoked_at ? " node-secret-item--revoked" : ""}`}
						>
							<div className="node-secret-item__head">
								<span className="node-secret-item__label">
									{secret.label ?? "unlabeled"}
								</span>
								{secret.revoked_at ? (
									<Badge tone="danger" size="sm">
										revoked
									</Badge>
								) : null}
							</div>
							<span className="node-secret-item__meta">
								{secret.last_used_at
									? `used ${formatAge(secret.last_used_at)}`
									: "never used"}
							</span>
							{!secret.revoked_at && (
								<Button
									variant="ghost"
									size="sm"
									disabled={revokeSecret.isPending}
									onClick={() =>
										revokeSecret.mutate({ nodeId, secretId: secret.id })
									}
								>
									Revoke
								</Button>
							)}
						</li>
					))}
				</ul>
			)}
			{adding ? (
				<NewSecretForm
					nodeId={nodeId}
					onCreated={(value) => {
						setRevealed(value);
						setAdding(false);
					}}
					onCancel={() => setAdding(false)}
				/>
			) : (
				<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
					New secret
				</Button>
			)}
			{revealed && (
				<div className="node-drawer__secret-reveal">
					<SecretReveal plaintext={revealed.plaintext} />
				</div>
			)}
		</>
	);
}

function DangerZone({
	node,
	remove,
	onDeleted,
}: {
	node: FleetNode;
	remove: RemoveMutation;
	onDeleted: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const [typed, setTyped] = useState("");
	const confirmed = typed.trim() === node.name && node.name.length > 0;
	const error = apiErrorMessage(remove.error);

	return (
		<div className="node-danger">
			{confirming ? (
				<div className="node-danger__confirm">
					<p>
						Type <strong>{node.name}</strong> to confirm deletion. The node will
						be disconnected and removed from this workspace.
					</p>
					<Input
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						placeholder={node.name}
						aria-label="Type the node name to confirm"
						error={error}
					/>
					<div className="node-danger__actions">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setConfirming(false);
								setTyped("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							size="sm"
							disabled={!confirmed || remove.isPending}
							onClick={() => remove.mutate(node.id, { onSuccess: onDeleted })}
						>
							{remove.isPending ? "Deleting…" : "Delete node"}
						</Button>
					</div>
				</div>
			) : (
				<Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
					Delete node
				</Button>
			)}
		</div>
	);
}

export function NodeDetailDrawer({ nodeId, onClose }: NodeDetailDrawerProps) {
	const drawer = useNodeDetailDrawer(nodeId);
	const { detail } = drawer;
	const node = detail.data?.node;

	return (
		<SideNav
			open={nodeId !== null}
			onClose={onClose}
			width="lg"
			title={node?.name ?? "Node"}
		>
			<style jsx>{nodeDrawerStyles}</style>
			{detail.isPending && <div className="node-drawer__state">Loading…</div>}
			{detail.isError && (
				<div className="node-drawer__state">
					Could not load this node — it may have been deleted.
					<Button variant="secondary" size="sm" onClick={onClose}>
						Close
					</Button>
				</div>
			)}
			{node && (
				<div className="node-drawer">
					<section className="node-drawer__section">
						<div className="node-drawer__status-row">
							<Badge
								tone={node.status === "online" ? "go" : "neutral"}
								size="sm"
							>
								<span className={`node-dot node-dot--${node.status}`} />
								{node.status}
							</Badge>
							<span className="node-drawer__meta">
								last seen {formatAge(node.last_seen_at)}
							</span>
						</div>
					</section>
					<section className="node-drawer__section">
						<h3 className="node-drawer__section-title">Details</h3>
						<DetailsList node={node} />
					</section>
					<section className="node-drawer__section">
						<h3 className="node-drawer__section-title">Rename</h3>
						<RenameForm node={node} />
					</section>
					<section className="node-drawer__section">
						<h3 className="node-drawer__section-title">Secrets</h3>
						<SecretsSection
							nodeId={node.id}
							secrets={detail.data?.secrets ?? []}
							drawer={drawer}
						/>
					</section>
					<section className="node-drawer__section node-drawer__section--danger">
						<h3 className="node-drawer__section-title">Danger zone</h3>
						<DangerZone
							node={node}
							remove={drawer.remove}
							onDeleted={onClose}
						/>
					</section>
				</div>
			)}
		</SideNav>
	);
}
