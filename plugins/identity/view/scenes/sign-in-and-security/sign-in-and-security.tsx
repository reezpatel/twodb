import { Button, Skeleton, Switch } from "@twodb/ui";
import css from "styled-jsx/css";
import { useSignInAndSecurity } from "./use-sign-in-and-security.hook";

function prettyMethod(m: string): string {
	if (m === "password") return "Password";
	if (m === "email_link") return "Magic link (email)";
	if (m === "phone_otp") return "Code by text";
	if (m.startsWith("sso.")) return `Single sign-on (${m.slice(4)})`;
	return m;
}

const styles = css`
	.sign-in-and-security {
		display: grid;
		gap: var(--space-5);
		max-width: 560px;
	}

	.sign-in-and-security > header {
		display: grid;
		gap: var(--space-1);
	}

	.sign-in-and-security h2 {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 650;
		line-height: 1.2;
	}

	.sign-in-and-security header p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.sign-in-and-security section {
		display: grid;
		gap: var(--space-2);
	}

	.sign-in-and-security h3 {
		margin: 0;
		font-family: var(--font-cue);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--tracking-narrow);
		color: var(--ink-3);
	}

	.sign-in-and-security ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
	}

	.sign-in-and-security li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--line);
	}

	.sign-in-and-security li:last-child {
		border-bottom: 1px solid var(--line);
	}

	.sign-in-and-security li strong {
		font-size: var(--text-sm);
		font-weight: 550;
	}

	.sign-in-and-security li .quiet {
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.sign-in-and-security p.alert {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--danger-bg);
		color: var(--danger-ink);
		border-radius: var(--r-sm);
		font-size: var(--text-sm);
	}
`;

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
		<div className="sign-in-and-security">
			<style jsx>{styles}</style>
			<header>
				<h2>Sign-in & security</h2>
				<p>Signed in as {userName ?? userId}.</p>
			</header>
			{error && <p className="alert">{error}</p>}

			<section>
				<h3>Sign-in methods</h3>
				<ul>
					{isLoading ? (
						<li>
							<Skeleton height={16} width="40%" />
						</li>
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
					{methods.length === 0 && !isLoading && (
						<li>
							<span className="quiet">No methods found.</span>
						</li>
					)}
				</ul>
			</section>

			<section>
				<h3>Verification</h3>
				<div>
					<Button
						onClick={() => void resendVerify.mutateAsync()}
						variant="secondary"
						type="button"
						disabled={resendVerify.isPending}
					>
						{resendVerify.isPending ? "Sending…" : "Resend verification code"}
					</Button>
				</div>
			</section>

			<section>
				<h3>Sign out</h3>
				<div>
					<Button
						onClick={() => void signOutEverywhere.mutateAsync()}
						variant="danger"
						type="button"
						disabled={signOutEverywhere.isPending}
					>
						{signOutEverywhere.isPending
							? "Signing out…"
							: "Sign out everywhere"}
					</Button>
				</div>
			</section>
		</div>
	);
}
