import { Button, Card, Input } from "@twodb/ui";
import { useWorkspaceCreator } from "./use-workspace-creator.hook";

export function WorkspaceCreator() {
	const {
		step,
		orgForm,
		workspaceForm,
		isPending,
		orgError,
		workspaceError,
		slugPattern,
	} = useWorkspaceCreator();

	return (
		<main className="workspace-creator">
			<style jsx>{`
				main.workspace-creator {
					display: grid;
					place-items: center;
					min-height: 100dvh;
					padding: var(--space-5);
					background: var(--bg);
				}

				.workspace-creator__card {
					width: 100%;
					max-width: 420px;
					display: grid;
					gap: var(--space-4);
				}

				.workspace-creator__card header {
					display: grid;
					gap: var(--space-1);
				}

				.workspace-creator__card h1 {
					margin: 0;
					font-size: var(--text-2xl);
					font-weight: 650;
					line-height: 1.1;
				}

				.workspace-creator__card p.lede {
					margin: 0;
					color: var(--ink-3);
				}

				.workspace-creator__card form {
					display: grid;
					gap: var(--space-3);
				}

				.workspace-creator__card p.alert {
					margin: 0;
					padding: var(--space-2) var(--space-3);
					background: var(--danger-bg);
					color: var(--danger-ink);
					border-radius: var(--r-sm);
					font-size: var(--text-sm);
				}
			`}</style>
			<Card density="normal">
				<section className="workspace-creator__card">
					<header>
						<h1>
							{step === "org"
								? "Create your organization"
								: "Create your first workspace"}
						</h1>
						<p className="lede">
							{step === "org"
								? "Organizations hold every workspace you make."
								: "A workspace is where your team lives. You can make more later."}
						</p>
					</header>

					{step === "org" ? (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void orgForm.handleSubmit();
							}}
						>
							<orgForm.Field
								name="name"
								validators={{
									onSubmit: ({ value }) =>
										!value.trim() ? "Enter an organization name" : undefined,
								}}
							>
								{(field) => (
									<Input
										label="Organization name"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.currentTarget.value)}
										error={field.state.meta.errors[0]}
										autoFocus
									/>
								)}
							</orgForm.Field>
							<orgForm.Field
								name="slug"
								validators={{
									onChange: ({ value }) => {
										if (!value) return undefined;
										return slugPattern.test(value)
											? undefined
											: "Use only lowercase letters, numbers, and hyphens";
									},
									onSubmit: ({ value }) => {
										if (!value.trim()) return "Enter a slug";
										return slugPattern.test(value)
											? undefined
											: "Use only lowercase letters, numbers, and hyphens";
									},
								}}
							>
								{(field) => (
									<Input
										label="Workspace URL slug"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.currentTarget.value)}
										hint="lowercase, letters/numbers/hyphens only"
										error={field.state.meta.errors[0]}
									/>
								)}
							</orgForm.Field>
							{orgError && <p className="alert">{orgError}</p>}
							<Button type="submit" variant="primary" disabled={isPending}>
								{isPending ? "Creating…" : "Create organization"}
							</Button>
						</form>
					) : (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void workspaceForm.handleSubmit();
							}}
						>
							<workspaceForm.Field
								name="name"
								validators={{
									onSubmit: ({ value }) =>
										!value.trim() ? "Enter a workspace name" : undefined,
								}}
							>
								{(field) => (
									<Input
										label="Workspace name"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.currentTarget.value)}
										error={field.state.meta.errors[0]}
										autoFocus
									/>
								)}
							</workspaceForm.Field>
							<workspaceForm.Field
								name="slug"
								validators={{
									onChange: ({ value }) => {
										if (!value) return undefined;
										return slugPattern.test(value)
											? undefined
											: "Use only lowercase letters, numbers, and hyphens";
									},
									onSubmit: ({ value }) => {
										if (!value.trim()) return "Enter a slug";
										return slugPattern.test(value)
											? undefined
											: "Use only lowercase letters, numbers, and hyphens";
									},
								}}
							>
								{(field) => (
									<Input
										label="Workspace slug"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.currentTarget.value)}
										hint="lowercase, letters/numbers/hyphens only"
										error={field.state.meta.errors[0]}
									/>
								)}
							</workspaceForm.Field>
							{workspaceError && <p className="alert">{workspaceError}</p>}
							<Button type="submit" variant="primary" disabled={isPending}>
								{isPending ? "Creating…" : "Create workspace"}
							</Button>
						</form>
					)}
				</section>
			</Card>
		</main>
	);
}
