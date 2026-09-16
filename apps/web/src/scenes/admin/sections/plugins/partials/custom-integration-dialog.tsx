import { Button, Dialog, Input } from "@twodb/ui";
import { IDENTIFIER_RE } from "../../../hooks/use-plugins-section";
import type { PluginsSectionState } from "./plugins-section.types";
import { customIntegrationDialogStyles } from "./custom-integration-dialog.style";

export function CustomIntegrationDialog({
	state,
}: {
	state: PluginsSectionState;
}) {
	return (
		<Dialog
			open={state.customDialogOpen}
			onClose={state.closeCustomDialog}
			title="Add a custom integration"
			footer={
				<>
					<Button variant="secondary" onClick={state.closeCustomDialog}>
						Cancel
					</Button>
					<Button
						type="submit"
						form="custom-integration-form"
						disabled={state.pendingIdentifier !== null}
					>
						{state.pendingIdentifier ? "Adding…" : "Add integration"}
					</Button>
				</>
			}
		>
			<style jsx>{customIntegrationDialogStyles}</style>
			<p className="plugins-dialog__copy">
				Enter an npm package or git repository identifier.
			</p>
			<form
				id="custom-integration-form"
				className="plugins-dialog__form"
				onSubmit={(event) => {
					event.preventDefault();
					state.form.handleSubmit();
				}}
			>
				<state.form.Field
					name="identifier"
					validators={{
						onChange: ({ value }) =>
							IDENTIFIER_RE.test(value.trim())
								? undefined
								: "Use npm:<package> or git:<repository URL>",
						onSubmit: ({ value }) =>
							IDENTIFIER_RE.test(value.trim())
								? undefined
								: "Use npm:<package> or git:<repository URL>",
					}}
				>
					{(field) => (
						<Input
							placeholder="npm:@twodb/notes"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
							error={field.state.meta.errors[0]}
						/>
					)}
				</state.form.Field>
				{state.customError ? (
					<p className="plugins-dialog__error" role="alert">
						{state.customError.message}
					</p>
				) : null}
			</form>
		</Dialog>
	);
}
