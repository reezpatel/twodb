import { Button, Input } from "@twodb/ui";
import { AuthShell } from "../../components/auth-shell/auth-shell";
import { useWorkspaceCreator } from "./use-workspace-creator.hook";

const SLUG_HINT = "lowercase, letters/numbers/hyphens only";
const SLUG_ERROR = "Use only lowercase letters, numbers, and hyphens";

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

	const slugValidators = {
		onChange: ({ value }: { value: string }) => {
			if (!value) return undefined;
			return slugPattern.test(value) ? undefined : SLUG_ERROR;
		},
		onSubmit: ({ value }: { value: string }) => {
			if (!value.trim()) return "Enter a slug";
			return slugPattern.test(value) ? undefined : SLUG_ERROR;
		},
	};

	return (
		<AuthShell
			title={
				step === "org"
					? "Create your organization"
					: "Create your first workspace"
			}
			lede={
				step === "org"
					? "Organizations hold every workspace you make."
					: "A workspace is where your team lives. You can make more later."
			}
		>
			{step === "org" ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void orgForm.handleSubmit();
					}}
				>
					<div className="auth__ledger">
						<orgForm.Field
							name="name"
							validators={{
								onSubmit: ({ value }) =>
									!value.trim() ? "Enter an organization name" : undefined,
							}}
						>
							{(field) => (
								<Input
									size="lg"
									label="Organization name"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
									error={field.state.meta.errors[0]}
									autoFocus
								/>
							)}
						</orgForm.Field>
						<orgForm.Field name="slug" validators={slugValidators}>
							{(field) => (
								<Input
									size="lg"
									label="URL slug"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
									hint={SLUG_HINT}
									error={field.state.meta.errors[0]}
								/>
							)}
						</orgForm.Field>
					</div>
					{orgError && <p className="alert">{orgError}</p>}
					<div className="auth__actions">
						<Button type="submit" variant="primary" size="lg" disabled={isPending}>
							{isPending ? "Creating…" : "Create organization"}
						</Button>
					</div>
				</form>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void workspaceForm.handleSubmit();
					}}
				>
					<div className="auth__ledger">
						<workspaceForm.Field
							name="name"
							validators={{
								onSubmit: ({ value }) =>
									!value.trim() ? "Enter a workspace name" : undefined,
							}}
						>
							{(field) => (
								<Input
									size="lg"
									label="Workspace name"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
									error={field.state.meta.errors[0]}
									autoFocus
								/>
							)}
						</workspaceForm.Field>
						<workspaceForm.Field name="slug" validators={slugValidators}>
							{(field) => (
								<Input
									size="lg"
									label="Slug"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.currentTarget.value)}
									hint={SLUG_HINT}
									error={field.state.meta.errors[0]}
								/>
							)}
						</workspaceForm.Field>
					</div>
					{workspaceError && <p className="alert">{workspaceError}</p>}
					<div className="auth__actions">
						<Button type="submit" variant="primary" size="lg" disabled={isPending}>
							{isPending ? "Creating…" : "Create workspace"}
						</Button>
					</div>
				</form>
			)}
		</AuthShell>
	);
}
