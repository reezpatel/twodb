import { useEffect, useState } from "react";
import { useIdentity } from "@twodb/shared-frontend";

interface MethodRow {
	id: string;
	method: string;
	enabled: boolean;
}

export function SignInAndSecurity() {
	const identity = useIdentity();
	const [methods, setMethods] = useState<MethodRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/v1/twodb.identity/me/auth-methods", { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : { methods: [] }))
			.then((d: { methods: MethodRow[] }) => setMethods(d.methods ?? []));
	}, []);

	async function toggle(id: string, enabled: boolean) {
		setError(null);
		const r = await fetch(`/api/v1/twodb.identity/me/auth-methods/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ enabled }),
		});
		if (!r.ok) {
			const data = (await r.json().catch(() => ({}))) as { error?: string };
			setError(data.error ?? "Couldn't change that method.");
			return;
		}
		setMethods((prev) =>
			prev.map((m) => (m.id === id ? { ...m, enabled } : m)),
		);
	}

	async function resendVerify() {
		setError(null);
		const r = await fetch("/api/v1/twodb.identity/auth/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({}),
		});
		if (!r.ok) {
			setError("Couldn't send a code right now.");
			return;
		}
	}

	async function signOutOtherSessions() {
		await fetch("/api/v1/twodb.identity/auth/logout", {
			method: "POST",
			credentials: "same-origin",
		});
		window.location.assign("/sign-in");
	}

	return (
		<section>
			<h2>Sign-in & security</h2>
			<p>Signed in as {identity.userName ?? identity.userId}.</p>
			{error && <p role="alert">{error}</p>}
			<h3>Your sign-in methods</h3>
			<ul>
				{methods.map((m) => (
					<li key={m.id}>
						<strong>{prettyMethod(m.method)}</strong>
						<label>
							<input
								type="checkbox"
								checked={m.enabled}
								onChange={(e) =>
									void toggle(m.id, e.currentTarget.checked)
								}
							/>
							Enabled
						</label>
					</li>
				))}
				{methods.length === 0 && <li>Loading…</li>}
			</ul>
			<h3>Verification</h3>
			<button onClick={() => void resendVerify()}>Resend verification code</button>
			<h3>Sign out</h3>
			<button onClick={() => void signOutOtherSessions()}>Sign out everywhere</button>
		</section>
	);
}

function prettyMethod(m: string): string {
	if (m === "password") return "Password";
	if (m === "email_link") return "Magic link (email)";
	if (m === "phone_otp") return "Code by text";
	if (m.startsWith("sso.")) return `Single sign-on (${m.slice(4)})`;
	return m;
}
