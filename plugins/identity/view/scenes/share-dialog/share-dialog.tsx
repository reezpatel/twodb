import { useForm } from "@tanstack/react-form";
import { Button, Input, Select } from "@twodb/ui";
import { useShareDialog } from "./use-share-dialog.hook";
import type { ShareDialogProps } from "@twodb/shared-frontend";

export function ShareDialog(props: ShareDialogProps) {
	const { grants, isLoading, invite, revoke, error, editableClaim } =
		useShareDialog(props);

	const form = useForm({
		defaultValues: { email: "", level: "read" as "read" | "edit" },
		onSubmit: async ({ value }) => {
			await invite.mutateAsync({
				email: value.email.trim(),
				level: value.level,
			});
			form.reset();
		},
	});

	return (
		<aside role="dialog" aria-label="Share" className="share-dialog">
			<style jsx>{`
				.share-dialog {
					display: grid;
					gap: var(--space-4);
					padding: var(--space-4);
					background: var(--surface);
					border-radius: var(--r-lg);
					box-shadow: var(--shadow-overlay);
					max-width: 420px;
				}

				.share-dialog h2 {
					margin: 0;
					font-size: var(--text-xl);
					font-weight: 650;
				}

				.share-dialog p.empty {
					margin: 0;
					color: var(--ink-3);
					font-size: var(--text-sm);
				}

				.share-dialog ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: grid;
					gap: var(--space-2);
				}

				.share-dialog li {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: var(--space-3);
					padding: var(--space-2) 0;
					border-bottom: 1px solid var(--line);
				}

				.share-dialog li span {
					font-size: var(--text-sm);
					color: var(--ink-2);
				}

				.share-dialog form {
					display: grid;
					gap: var(--space-3);
				}

				.share-dialog p.alert {
					margin: 0;
					padding: var(--space-2) var(--space-3);
					background: var(--danger-bg);
					color: var(--danger-ink);
					border-radius: var(--r-sm);
					font-size: var(--text-sm);
				}
			`}</style>
			<h2>People in this {props.entityType}</h2>
			{isLoading ? (
				<p className="empty">Loading…</p>
			) : grants.length === 0 ? (
				<p className="empty">No one else has access yet.</p>
			) : (
				<ul>
					{grants.map((g) => (
						<li key={g.id}>
							<span>{g.user.name || g.user.email || g.user.id}</span>
							<span>
								{g.claims.includes(editableClaim) ? "can edit" : "can look"}
							</span>
							<Button
								size="sm"
								variant="ghost"
								type="button"
								onClick={() => void revoke.mutateAsync(g.id)}
								disabled={revoke.isPending}
							>
								Remove
							</Button>
						</li>
					))}
				</ul>
			)}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="email"
					validators={{
						onSubmit: ({ value }) =>
							!value.trim() ? "Enter an email or phone" : undefined,
					}}
				>
					{(field) => (
						<Input
							label="Invite by email or phone"
							type="email"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.currentTarget.value)}
							error={field.state.meta.errors[0]}
						/>
					)}
				</form.Field>
				<form.Field name="level">
					{(field) => (
						<Select
							label="Permission"
							options={[
								{ value: "read", label: "can only look" },
								{ value: "edit", label: "can edit" },
							]}
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as "read" | "edit")
							}
						/>
					)}
				</form.Field>
				{error && <p className="alert">{error}</p>}
				<Button type="submit" variant="primary" disabled={invite.isPending}>
					{invite.isPending ? "Inviting…" : "Invite"}
				</Button>
			</form>
		</aside>
	);
}
