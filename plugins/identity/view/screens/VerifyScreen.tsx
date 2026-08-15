import { useState } from "react";
import { useIdentity } from "@twodb/shared-frontend";

export function VerifyScreen() {
	const identity = useIdentity();
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	async function requestCode() {
		setError(null);
		const session = await fetch("/api/v1/twodb.identity/auth/session", {
			credentials: "same-origin",
		});
		const data = session.ok
			? ((await session.json()) as { principal: { userId: string } | null })
			: { principal: null };
		if (!data.principal?.userId) {
			window.location.assign("/sign-in");
			return;
		}
		const r = await fetch("/api/v1/twodb.identity/auth/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({}),
		});
		if (!r.ok) {
			setError("Couldn't send a code right now. Try again in a moment.");
			return;
		}
		setSent(true);
	}

	async function confirm() {
		setError(null);
		const r = await fetch("/api/v1/twodb.identity/auth/verify/confirm", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ code: code.trim() }),
		});
		if (!r.ok) {
			setError("That code didn't work — ask for a new one.");
			return;
		}
		location.reload();
	}

	return (
		<div style={{ maxWidth: 360, margin: "10vh auto", padding: 24 }}>
			<h1>Confirm it's you</h1>
			<p>Welcome, {identity.userName ?? "user"}.</p>
			<p>We sent a code to the address on file. Enter it to continue.</p>
			<button onClick={requestCode} disabled={sent}>
				{sent ? "Code sent" : "Send a code"}
			</button>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void confirm();
				}}
				style={{ marginTop: 16 }}
			>
				<label>
					<span>Code</span>
					<input
						value={code}
						onChange={(e) => setCode(e.currentTarget.value)}
						inputMode="numeric"
						autoComplete="one-time-code"
					/>
				</label>
				{error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
				<button type="submit">Confirm</button>
			</form>
			<p style={{ marginTop: 16, color: "var(--ink-muted)" }}>
				You can only reach this screen — verify, or sign out — until confirmed.
			</p>
			<button
				onClick={async () => {
					await fetch("/api/v1/twodb.identity/auth/logout", {
						method: "POST",
						credentials: "same-origin",
					});
					window.location.assign("/sign-in");
				}}
			>
				Sign out
			</button>
		</div>
	);
}
