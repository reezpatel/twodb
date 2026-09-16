import { Cloud, Fingerprint, ShieldCheck, Zap } from "lucide-react";
import { adminAuthStyles } from "./admin-auth.style";
import { useAdminSession } from "./hooks/use-admin-session";
import { usePasskeys } from "./hooks/use-passkeys";
import type { AdminSessionState } from "./lib/admin-api";
import { Button } from "@twodb/ui";

function errorMessage(error: unknown): string | null {
	if (!error) return null;
	return error instanceof Error ? error.message : "Something went wrong";
}

const POINTS = [
	{ icon: ShieldCheck, label: "Next level security" },
	{ icon: Zap, label: "Quick and seamless log in" },
	{ icon: Cloud, label: "Passkey is stored securely in the cloud" },
] as const;

// Pre-auth surface: bootstrap (no passkeys yet) or login.
export function AdminAuth({ session }: { session: AdminSessionState }) {
	const { login } = useAdminSession();
	const { registerPasskey } = usePasskeys();

	const bootstrap = session.bootstrapRequired;
	const pending = bootstrap ? registerPasskey.isPending : login.isPending;
	const error = errorMessage(bootstrap ? registerPasskey.error : login.error);

	return (
		<main className="admin__body" aria-label="Admin sign in">
			<style jsx>{adminAuthStyles}</style>
			<div className="admin__auth">
				<div className="admin__auth-hero">
					<Fingerprint size={48} strokeWidth={1.5} />
				</div>

				<h1 className="admin__auth-title">
					{bootstrap
						? "Set up a passkey to log in with fingerprint, face, or passcode"
						: "Log in with fingerprint, face, or passcode"}
				</h1>

				<ul className="admin__auth-points">
					{POINTS.map(({ icon: Icon, label }) => (
						<li key={label} className="admin__auth-point">
							<Icon size={20} strokeWidth={1.75} />
							{label}
						</li>
					))}
				</ul>

				<Button
					size="xl"
					fullWidth
					disabled={pending}
					onClick={() =>
						bootstrap
							? registerPasskey.mutate("Primary passkey")
							: login.mutate()
					}
				>
					{bootstrap
						? pending
							? "Setting up…"
							: "Set up passkey"
						: pending
							? "Waiting for passkey…"
							: "Log in with passkey"}
				</Button>

				{error && <p className="admin__error">{error}</p>}
			</div>
		</main>
	);
}
