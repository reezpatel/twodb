import { useEffect, useState } from "react";
import { useIdentity, type ShareDialogProps } from "@twodb/shared-frontend";

interface GrantRow {
	id: string;
	user: { id: string; name: string; email: string | null };
	claims: string[];
}

export function ShareDialog(props: ShareDialogProps) {
	const identity = useIdentity();
	const [grants, setGrants] = useState<GrantRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [pendingEmail, setPendingEmail] = useState("");
	const [pendingClaim, setPendingClaim] = useState("read");

	const readableClaim = "plugin.twodb.notes:note.read";
	const editableClaim = "plugin.twodb.notes:note.edit";

	useEffect(() => {
		void loadGrants();
	}, [props.workspaceId, props.entityType, props.entityId]);

	async function loadGrants() {
		const r = await fetch(
			`/api/v1/twodb.identity/grants?workspaceId=${encodeURIComponent(props.workspaceId)}&entityType=${encodeURIComponent(props.entityType)}&entityId=${encodeURIComponent(props.entityId)}`,
			{ credentials: "same-origin" },
		);
		if (!r.ok) return;
		const data = (await r.json()) as { grants: GrantRow[] };
		setGrants(data.grants ?? []);
	}

	async function invite() {
		setError(null);
		if (!identity.workspaceId) return;
		const invite = await fetch(`/api/v1/twodb.identity/workspaces/${identity.workspaceId}/members`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ identifier: pendingEmail.trim(), role: "guest" }),
		});
		if (!invite.ok) {
			const data = (await invite.json().catch(() => ({}))) as { error?: string };
			setError(data.error ?? "Couldn't invite that user.");
			return;
		}
		const { userId } = (await invite.json()) as { userId: string };
		const claim = pendingClaim === "edit" ? editableClaim : readableClaim;
		const grant = await fetch("/api/v1/twodb.identity/grants", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({
				workspaceId: identity.workspaceId,
				entityType: props.entityType,
				entityId: props.entityId,
				userId,
				claims: [claim],
			}),
		});
		if (!grant.ok) {
			const data = (await grant.json().catch(() => ({}))) as { error?: string };
			setError(data.error ?? "Couldn't grant access.");
			return;
		}
		setPendingEmail("");
		await loadGrants();
	}

	async function revoke(id: string) {
		const r = await fetch(`/api/v1/twodb.identity/grants/${id}`, {
			method: "DELETE",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ workspaceId: props.workspaceId }),
		});
		if (!r.ok) return;
		await loadGrants();
	}

	return (
		<aside role="dialog" aria-label="Share">
			<h2>People in this {props.entityType}</h2>
			{grants.length === 0 && <p>No one else has access yet.</p>}
			<ul>
				{grants.map((g) => (
					<li key={g.id}>
						<span>{g.user.name || g.user.email || g.user.id}</span>
						<span>
							{g.claims.includes(editableClaim) ? "can edit" : "can look"}
						</span>
						<button onClick={() => void revoke(g.id)} aria-label="Remove">
							Remove
						</button>
					</li>
				))}
			</ul>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void invite();
				}}
			>
				<input
					type="email"
					placeholder="someone@example.com"
					value={pendingEmail}
					onChange={(e) => setPendingEmail(e.currentTarget.value)}
					required
				/>
				<select
					value={pendingClaim}
					onChange={(e) => setPendingClaim(e.currentTarget.value)}
				>
					<option value="read">can only look</option>
					<option value="edit">can edit</option>
				</select>
				<button type="submit">Invite</button>
			</form>
			{error && <p role="alert">{error}</p>}
		</aside>
	);
}
