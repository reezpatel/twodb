import { useForm } from "@tanstack/react-form";
import { Link } from "react-router";
import { Button, Card, Input } from "@twodb/ui";
import { useAuthMethods, useLoginMutation } from "./use-login.hook";

export function LoginScreen() {
	const form = useForm({
		defaultValues: { identifier: "", password: "" },
		onSubmit: async ({ value }) => {
			await loginMut.mutateAsync({
				identifier: value.identifier.trim(),
				password: value.password,
			});
			window.location.assign("/");
		},
	});

	const loginMut = useLoginMutation();
	const { data: methodsData } = useAuthMethods();
	const showPassword = (methodsData?.methods ?? []).some(
		(m) => m.method === "password" && m.enabled,
	);

	return (
		<main>
			<style jsx>{`
				main {
					display: grid;
					place-items: center;
					min-height: 100dvh;
					padding: var(--space-5);
					background: var(--bg);
				}
				section {
					width: 100%;
					max-width: 380px;
					display: grid;
					gap: var(--space-4);
				}
				header {
					display: grid;
					gap: var(--space-1);
				}
				h1 {
					margin: 0;
					font-size: var(--text-2xl);
					font-weight: 650;
					line-height: 1.1;
				}
				p.lede {
					margin: 0;
					color: var(--ink-3);
				}
				form {
					display: grid;
					gap: var(--space-3);
				}
				form > div.toggle {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: var(--space-3);
					padding-top: var(--space-2);
					border-top: 1px solid var(--line);
					color: var(--ink-3);
					font-size: var(--text-sm);
				}
				p.alert {
					margin: 0;
					padding: var(--space-2) var(--space-3);
					background: var(--danger-bg);
					color: var(--danger-ink);
					border-radius: var(--r-sm);
					font-size: var(--text-sm);
				}
			`}</style>
			<Card density="normal">
				<section>
					<header>
						<h1>Sign in to twodb</h1>
						<p className="lede">Use the email or phone you signed up with.</p>
					</header>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
					>
						<form.Field name="identifier">
							{(field) => (
								<Input
									label="Email or phone"
									type="text"
									value={field.state.value}
									onChange={(e) =>
										field.handleChange((e.target as HTMLInputElement).value)
									}
									required
									autoFocus
								/>
							)}
						</form.Field>
						{showPassword && (
							<form.Field name="password">
								{(field) => (
									<Input
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
						{loginMut.error && (
							<p className="alert">
								{(loginMut.error as { message?: string }).message ??
									"Something went wrong."}
							</p>
						)}
						<Button
							type="submit"
							variant="primary"
							disabled={loginMut.isPending}
						>
							{loginMut.isPending ? "Signing in…" : "Sign in"}
						</Button>
						<div className="toggle">
							<span>New here?</span>
							<Link to="/register">
								<Button variant="ghost" size="sm" type="button">
									Create an account
								</Button>
							</Link>
						</div>
					</form>
				</section>
			</Card>
		</main>
	);
}
