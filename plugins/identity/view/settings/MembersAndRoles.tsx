import { useEffect, useState } from "react";
import { useIdentity } from "@twodb/shared-frontend";

interface RoleRow {
	id: string;
	key: string;
	name: string;
	isSystem: boolean;
	claims: { claim: string; dangling: boolean }[];
}
interface Member {
	userId: string;
	name: string;
	email: string | null;
	roleIds: string[];
}

export function MembersAndRoles() {
	const identity = useIdentity();
	const [roles, setRoles] = useState<RoleRow[]>([]);
	const [catalog, setCatalog] = useState<string[]>([]);
	const [members, setMembers] = useState<Member[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!identity.workspaceId) return;
		Promise.all([
			fetch(`/api/v1/twodb.identity/workspaces/${identity.workspaceId}/roles`, {
				credentials: "same-origin",
			}).then((r) => (r.ok ? r.json() : { roles: [], catalog: [] })),
			fetch(`/api/v1/twodb.identity/workspaces/${identity.workspaceId}/members`, {
				credentials: "same-origin",
			}).then((r) => (r.ok ? r.json() : { members: [] })),
		]).then(([r, m]: [{ roles: RoleRow[]; catalog: string[] }, { members: Member[] }]) => {
			setRoles(r.roles ?? []);
			setCatalog(r.catalog ?? []);
			setMembers(m.members ?? []);
		});
	}, [identity.workspaceId]);

	async function createRole(name: string, claims: string[]) {
		if (!identity.workspaceId) return;
		setError(null);
		const r = await fetch(`/api/v1/twodb.identity/workspaces/${identity.workspaceId}/roles`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ name, claims }),
		});
		if (!r.ok) {
			setError("Couldn't create that role.");
			return;
		}
		const refreshed = await fetch(`/api/v1/twodb.identity/workspaces/${identity.workspaceId}/roles`, { credentials: "same-origin" });
		if (refreshed.ok) {
			const data = (await refreshed.json()) as { roles: RoleRow[]; catalog: string[] };
			setRoles(data.roles);
			setCatalog(data.catalog);
		}
	}

	if (!identity.hasClaim("plugin.twodb.identity:role.manage")) {
		return null;
	}

	const grouped = new Map<string, string[]>();
	for (const c of catalog) {
		const ns = c.startsWith("plugin.") ? "plugin." : "app.";
		const list = grouped.get(ns) ?? [];
		list.push(c);
		grouped.set(ns, list);
	}

	return (
		<section>
			<h2>People in this workspace</h2>
			{error && <p role="alert">{error}</p>}
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Roles</th>
					</tr>
				</thead>
				<tbody>
					{members.map((m) => (
						<tr key={m.userId}>
							<td>{m.name || m.email || m.userId}</td>
							<td>
								{roles
									.filter((r) => m.roleIds.includes(r.id))
									.map((r) => r.name)
									.join(", ") || "—"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<h3>Roles</h3>
			<ul>
				{roles.map((r) => (
					<li key={r.id}>
						<strong>{r.name}</strong>
						{r.isSystem && (
							<small> · system role — clone to customize</small>
						)}
						<ul>
							{r.claims.map((c) => (
								<li key={c.claim}>
									{c.claim.replace(/^plugin\.[^.]+\./, "").replace(/:[^:]+$/, " · $&")}
									{c.dangling && <small> · from a turned-off feature</small>}
								</li>
							))}
							{r.claims.length === 0 && <li>—</li>}
						</ul>
					</li>
				))}
			</ul>
			<details>
				<summary>Add a custom role</summary>
				<NewRoleForm onSubmit={(name, claims) => void createRole(name, claims)} groups={grouped} />
			</details>
		</section>
	);
}

function NewRoleForm(props: {
	onSubmit: (name: string, claims: string[]) => void;
	groups: Map<string, string[]>;
}) {
	const [name, setName] = useState("");
	const [picked, setPicked] = useState<string[]>([]);
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				props.onSubmit(name, picked);
				setName("");
				setPicked([]);
			}}
		>
			<input
				required
				placeholder="Role name"
				value={name}
				onChange={(e) => setName(e.currentTarget.value)}
			/>
			{[...props.groups.entries()].map(([ns, claims]) => (
				<fieldset key={ns}>
					<legend>{ns}</legend>
					{claims.map((c) => (
						<label key={c}>
							<input
								type="checkbox"
								checked={picked.includes(c)}
								onChange={(e) =>
									setPicked((prev) =>
										e.currentTarget.checked
											? [...prev, c]
											: prev.filter((p) => p !== c),
									)
								}
							/>
							<span>{c.replace(/^plugin\.[^.]+\.|:.*$/g, "")}</span>
						</label>
					))}
				</fieldset>
			))}
			<button type="submit">Create role</button>
		</form>
	);
}
