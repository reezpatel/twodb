import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import {
	Button,
	Checkbox,
	Input,
	Table,
	TBody,
	THead,
	TR,
	TH,
	TD,
} from "@twodb/ui";
import css from "styled-jsx/css";
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

const styles = css`
	.members-and-roles {
		display: grid;
		gap: var(--space-5);
		max-width: 640px;
	}

	.members-and-roles > header {
		display: grid;
		gap: var(--space-1);
	}

	.members-and-roles h2 {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 650;
		line-height: 1.2;
	}

	.members-and-roles h3 {
		margin: 0;
		font-family: var(--font-cue);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-narrow);
		color: var(--ink-3);
	}

	.members-and-roles section {
		display: grid;
		gap: var(--space-3);
	}

	.members-and-roles ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
	}

	.members-and-roles ul.members > li {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--line);
	}

	.members-and-roles ul.members > li:last-child {
		border-bottom: 1px solid var(--line);
	}

	.members-and-roles li ul {
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
		display: grid;
		gap: var(--space-2);
	}

	.members-and-roles legend {
		padding: 0 var(--space-2);
		font-family: var(--font-cue);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-narrow);
		color: var(--ink-3);
	}

	.members-and-roles form {
		display: grid;
		gap: var(--space-3);
	}

	.members-and-roles details summary {
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: 550;
		color: var(--accent);
		padding: var(--space-2) 0;
	}

	.members-and-roles p.alert {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--danger-bg);
		color: var(--danger-ink);
		border-radius: var(--r-sm);
		font-size: var(--text-sm);
	}
`;

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
		<div className="members-and-roles">
			<style jsx>{styles}</style>
			<header>
				<h2>People in this workspace</h2>
			</header>
			{error && <p className="alert">{error}</p>}
			{isLoading ? (
				<p>Loading…</p>
			) : (
				<Table>
					<THead>
						<TR>
							<TH>Name</TH>
							<TH>Roles</TH>
						</TR>
					</THead>
					<TBody>
						{members.map((m) => (
							<TR key={m.userId}>
								<TD>{m.name || m.email || m.userId}</TD>
								<TD>
									{roles
										.filter((r) => m.roleIds.includes(r.id))
										.map((r) => r.name)
										.join(", ") || "—"}
								</TD>
							</TR>
						))}
					</TBody>
				</Table>
			)}
			<section>
				<h3>Roles</h3>
				<ul className="members">
					{roles.map((r) => (
						<li key={r.id}>
							<strong>
								{r.name}
								{r.isSystem && (
									<small> · system role — clone to customize</small>
								)}
							</strong>
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
			</section>
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
											<Checkbox
												key={c}
												label={c.replace(/^plugin\.[^.]+\.:.*$/g, "")}
												checked={field.state.value.includes(c)}
												onChange={(e) => {
													const next = e.currentTarget.checked
														? [...field.state.value, c]
														: field.state.value.filter((p) => p !== c);
													field.handleChange(next);
												}}
											/>
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
		</div>
	);
}
