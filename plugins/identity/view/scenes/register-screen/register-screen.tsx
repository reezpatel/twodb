import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "react-router";
import { Button, Input } from "@twodb/ui";
import { AuthShell } from "../../components/auth-shell/auth-shell";
import { useAuthMethods, useRegisterMutation } from "./use-register.hook";

export const RegisterScreen = () => {
	const navigate = useNavigate();

	const form = useForm({
		defaultValues: { name: "", identifier: "", password: "" },
		onSubmit: async ({ value }) => {
			await registerMut.mutateAsync({
				name: value.name.trim(),
				identifier: value.identifier.trim(),
				password: value.password,
			});
			navigate("/");
		},
	});

	const registerMut = useRegisterMutation();
	const { data: methodsData } = useAuthMethods();
	const showPassword = (methodsData?.methods ?? []).includes("password");

	return (
		<AuthShell
			title="Create your account"
			lede="Pick an email or phone and a password to get started."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<div className="auth__ledger">
					<form.Field name="name">
						{(field) => (
							<Input
								size="lg"
								label="Your name"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange((e.target as HTMLInputElement).value)
								}
								required
								autoFocus
							/>
						)}
					</form.Field>
					<form.Field name="identifier">
						{(field) => (
							<Input
								size="lg"
								label="Email or phone"
								type="text"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange((e.target as HTMLInputElement).value)
								}
								required
							/>
						)}
					</form.Field>
					{showPassword && (
						<form.Field name="password">
							{(field) => (
								<Input
									size="lg"
									label="Password"
									type="password"
									value={field.state.value}
									onChange={(e) =>
										field.handleChange((e.target as HTMLInputElement).value)
									}
									required
									minLength={8}
								/>
							)}
						</form.Field>
					)}
				</div>
				{registerMut.error && (
					<p className="alert">
						{(registerMut.error as { message?: string }).message ??
							"Something went wrong."}
					</p>
				)}
				<div className="auth__actions">
					<Button
						type="submit"
						variant="primary"
						size="lg"
						disabled={registerMut.isPending}
					>
						{registerMut.isPending ? "Creating…" : "Create account"}
					</Button>
				</div>
			</form>
			<div className="auth__switch-row">
				<span>Already have an account?</span>
				<Link to="/login">Sign in instead</Link>
			</div>
		</AuthShell>
	);
};
