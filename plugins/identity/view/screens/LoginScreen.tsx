import { useState } from "react";
import { ApiClient } from "@twodb/shared-frontend";

type Method = { method: string; enabled: boolean };

const api = new ApiClient("/api/v1/twodb.identity");

export function LoginScreen() {
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [methods, setMethods] = useState<Method[]>([]);

	useState(() => {
		fetch("/api/v1/twodb.identity/auth/methods", { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : { methods: [] }))
			.then((d: { methods: Method[] }) => setMethods(d.methods ?? []))
			.catch(() => setMethods([]));
		return null;
	});

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const body = { identifier: identifier.trim(), password };
		const r = await fetch("/api/v1/twodb.identity/auth/login", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify(body),
		});
		if (!r.ok) {
			const data = (await r.json().catch(() => ({}))) as { error?: string };
			setError(data.error ?? "Sign in failed.");
			return;
		}
		window.location.assign("/");
	}

	const showPassword = methods.some((m) => m.method === "password" && m.enabled);

	return (
		<div style={{ maxWidth: 360, margin: "10vh auto", padding: 24 }}>
			<h1>Sign in to twodb</h1>
			<p style={{ color: "var(--ink-muted)" }}>Use the email or phone you signed up with.</p>
			<form onSubmit={onSubmit}>
				<label>
					<span>Email or phone</span>
					<input
						type="text"
						value={identifier}
						onChange={(e) => setIdentifier(e.currentTarget.value)}
						required
						autoFocus
						style={{ width: "100%", padding: "var(--space-2)" }}
					/>
				</label>
				{showPassword && (
					<label>
						<span>Password</span>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
							required
							style={{ width: "100%", padding: "var(--space-2)" }}
						/>
					</label>
				)}
				{error && (
					<p role="alert" style={{ color: "var(--danger)" }}>{error}</p>
				)}
				<button type="submit" style={{ marginTop: 16 }}>Sign in</button>
			</form>
			{!showPassword && methods.length > 0 && (
				<p style={{ marginTop: 16, color: "var(--ink-muted)" }}>
					Choose another sign-in method to continue.
				</p>
			)}
		</div>
	);
}
