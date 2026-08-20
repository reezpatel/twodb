import { useForm } from "@tanstack/react-form";
import { Button, Input } from "@twodb/ui";
import { AuthShell } from "../../components/auth-shell/auth-shell";
import { useVerify } from "./use-verify.hook";
import { useTwoDbIdentity } from "../../provider/identity-provider";

export function VerifyScreen() {
	const { userName, sent, requestCode, confirm, error } = useVerify();
	const { signOut } = useTwoDbIdentity();

	const form = useForm({
		defaultValues: { code: "" },
		onSubmit: async ({ value }) => {
			await confirm.mutateAsync(value.code.trim());
		},
	});

	return (
		<AuthShell
			title="Confirm it's you"
			lede={`Welcome, ${userName ?? "user"}. We sent a code to the address on file — enter it to continue.`}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<div className="auth__ledger">
					<form.Field
						name="code"
						validators={{
							onSubmit: ({ value }) =>
								!value.trim() ? "Enter the code we sent" : undefined,
						}}
					>
						{(field) => (
							<Input
								size="lg"
								label="Code"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.currentTarget.value)}
								inputMode="numeric"
								autoComplete="one-time-code"
								error={field.state.meta.errors[0] ?? error ?? undefined}
							/>
						)}
					</form.Field>
				</div>
				<div className="auth__actions">
					<Button
						onClick={() => void requestCode.mutateAsync()}
						disabled={sent || requestCode.isPending}
						variant="secondary"
						type="button"
					>
						{sent
							? "Code sent"
							: requestCode.isPending
								? "Sending…"
								: "Send a code"}
					</Button>
					<Button type="submit" variant="primary" size="lg" disabled={confirm.isPending}>
						{confirm.isPending ? "Confirming…" : "Confirm"}
					</Button>
				</div>
			</form>
			<p className="hint">
				You can only reach this screen — verify, or sign out — until confirmed.
			</p>
			<div className="auth__switch-row">
				<span>Signed in as the wrong person?</span>
				<Button onClick={() => void signOut()} variant="ghost" type="button">
					Sign out
				</Button>
			</div>
		</AuthShell>
	);
}
