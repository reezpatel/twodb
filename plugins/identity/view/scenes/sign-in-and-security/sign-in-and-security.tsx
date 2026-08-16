import { Button, Switch } from "@twodb/ui";
import { useSignInAndSecurity } from "./use-sign-in-and-security.hook";

function prettyMethod(m: string): string {
	if (m === "password") return "Password";
	if (m === "email_link") return "Magic link (email)";
	if (m === "phone_otp") return "Code by text";
	if (m.startsWith("sso.")) return `Single sign-on (${m.slice(4)})`;
	return m;
}

export function SignInAndSecurity() {
	const {
		userName,
		userId,
		methods,
		isLoading,
		error,
		toggle,
		resendVerify,
		signOutEverywhere,
	} = useSignInAndSecurity();

	return (
		<section className="sign-in-and-security">
			<style jsx>{`
				.sign-in-and-security {
					display: grid;
					gap: var(--space-4);
				}

				.sign-in-and-security h2,
				.sign-in-and-security h3 {
					margin: 0;
					font-weight: 650;
				}

				.sign-in-and-security h2 {
					font-size: var(--text-xl);
				}

				.sign-in-and-security h3 {
					font-size: var(--text-lg);
				}

				.sign-in-and-security ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: grid;
					gap: var(--space-3);
				}

				.sign-in-and-security li {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: var(--space-3);
					padding: var(--space-2) 0;
					border-bottom: 1px solid var(--line);
				}

				.sign-in-and-security li strong {
					font-size: var(--text-sm);
				}

				.sign-in-and-security p {
					margin: 0;
					font-size: var(--text-sm);
					color: var(--ink-2);
				}

				.sign-in-and-security p.alert {
					color: var(--danger-ink);
					background: var(--danger-bg);
					padding: var(--space-2) var(--space-3);
					border-radius: var(--r-sm);
				}

				.sign-in-and-security__actions {
					display: flex;
					gap: var(--space-2);
					flex-wrap: wrap;
				}
			`}</style>
			<h2>Sign-in & security</h2>
			<p>Signed in as {userName ?? userId}.</p>
			{error && <p className="alert">{error}</p>}

			<h3>Your sign-in methods</h3>
			<ul>
				{isLoading ? (
					<li>Loading…</li>
				) : (
					methods.map((m) => (
						<li key={m.id}>
							<strong>{prettyMethod(m.method)}</strong>
							<Switch
								checked={m.enabled}
								onChange={(e) =>
									void toggle.mutateAsync({
										id: m.id,
										enabled: e.currentTarget.checked,
									})
								}
								disabled={toggle.isPending}
								aria-label={`${prettyMethod(m.method)} enabled`}
							/>
						</li>
					))
				)}
				{methods.length === 0 && !isLoading && <li>No methods found.</li>}
			</ul>

			<h3>Verification</h3>
			<div className="sign-in-and-security__actions">
				<Button
					onClick={() => void resendVerify.mutateAsync()}
					variant="secondary"
					type="button"
					disabled={resendVerify.isPending}
				>
					{resendVerify.isPending ? "Sending…" : "Resend verification code"}
				</Button>
			</div>

			<h3>Sign out</h3>
			<div className="sign-in-and-security__actions">
				<Button
					onClick={() => void signOutEverywhere.mutateAsync()}
					variant="danger"
					type="button"
					disabled={signOutEverywhere.isPending}
				>
					{signOutEverywhere.isPending ? "Signing out…" : "Sign out everywhere"}
				</Button>
			</div>
		</section>
	);
}
