import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { Button, Input } from "@twodb/ui";
import { useMembersAndRoles } from "./use-members-and-roles.hook";

function groupCatalog(catalog: string[]) {
	const grouped = new Map<string, string[]>();
	for (const c of catalog) {
		const ns = c.startsWith("plugin.") ? "plugin." : "app.";
		const list = grouped.get(ns) ?? [];
		list.push(c);
		grouped.set(ns, list);
	}
	return grouped;
}

function prettyClaim(c: string): string {
	return c.replace(/^plugin\.[^.]+\./, "").replace(/:[^:]+$/, " · $&");
}

export function MembersAndRoles() {
	const { canManage, roles, catalog, members, isLoading, error, createRole } =
		useMembersAndRoles();

	const groupedCatalog = useMemo(() => groupCatalog(catalog), [catalog]);

	const form = useForm({
		defaultValues: { name: "", claims: [] as string[] },
		onSubmit: async ({ value }) => {
			await createRole.mutateAsync({
				name: value.name.trim(),
				claims: value.claims,
			});
			form.reset();
		},
	});

	if (!canManage) return null;

	return (
		<section className="members-and-roles">
			<style jsx>{`
				.members-and-roles {
					display: grid;
					gap: var(--space-4);
				}

				.members-and-roles h2,
				.members-and-roles h3 {
					margin: 0;
					font-weight: 650;
				}

				.members-and-roles h2 {
					font-size: var(--text-xl);
				}

				.members-and-roles h3 {
					font-size: var(--text-lg);
				}

				.members-and-roles table {
					width: 100%;
					border-collapse: collapse;
					font-size: var(--text-sm);
				}

				.members-and-roles th,
				.members-and-roles td {
					text-align: left;
					padding: var(--space-2) var(--space-3);
					border-bottom: 1px solid var(--line);
				}

				.members-and-roles th {
					color: var(--ink-3);
					font-weight: 600;
				}

				.members-and-roles ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: grid;
					gap: var(--space-3);
				}

				.members-and-roles li {
					display: grid;
					gap: var(--space-1);
				}

				.members-and-roles li ul {
					margin-left: var(--space-3);
					gap: var(--space-1);
				}

				.members-and-roles li ul li {
					font-size: var(--text-sm);
					color: var(--ink-2);
				}

				.members-and-roles small {
					color: var(--ink-3);
				}

				.members-and-roles fieldset {
					border: 1px solid var(--line);
					border-radius: var(--r-md);
					padding: var(--space-3);
					margin: 0;
				}

				.members-and-roles legend {
					padding: 0 var(--space-2);
					font-size: var(--text-xs);
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: var(--tracking-narrow);
					color: var(--ink-3);
				}

				.members-and-roles label {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-sm);
					cursor: pointer;
				}

				.members-and-roles p.alert {
					margin: 0;
					padding: var(--space-2) var(--space-3);
					background: var(--danger-bg);
					color: var(--danger-ink);
					border-radius: var(--r-sm);
					font-size: var(--text-sm);
				}
			`}</style>
			<h2>People in this workspace</h2>
			{error && <p className="alert">{error}</p>}
			{isLoading ? (
				<p>Loading…</p>
			) : (
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
			)}
			<h3>Roles</h3>
			<ul>
				{roles.map((r) => (
					<li key={r.id}>
						<strong>{r.name}</strong>
						{r.isSystem && <small> · system role — clone to customize</small>}
						<ul>
							{r.claims.map((c) => (
								<li key={c.claim}>
									{prettyClaim(c.claim)}
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
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field
						name="name"
						validators={{
							onSubmit: ({ value }) =>
								!value.trim() ? "Enter a role name" : undefined,
						}}
					>
						{(field) => (
							<Input
								label="Role name"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.currentTarget.value)}
								error={field.state.meta.errors[0]}
							/>
						)}
					</form.Field>
					<form.Field name="claims">
						{(field) => (
							<>
								{[...groupedCatalog.entries()].map(([ns, claims]) => (
									<fieldset key={ns}>
										<legend>{ns}</legend>
										{claims.map((c) => (
											<label key={c}>
												<input
													type="checkbox"
													checked={field.state.value.includes(c)}
													onChange={(e) => {
														const next = e.currentTarget.checked
															? [...field.state.value, c]
															: field.state.value.filter((p) => p !== c);
														field.handleChange(next);
													}}
												/>
												<span>{c.replace(/^plugin\.[^.]+\.:.*$/g, "")}</span>
											</label>
										))}
									</fieldset>
								))}
							</>
						)}
					</form.Field>
					<Button
						type="submit"
						variant="primary"
						disabled={createRole.isPending}
					>
						{createRole.isPending ? "Creating…" : "Create role"}
					</Button>
				</form>
			</details>
		</section>
	);
}
