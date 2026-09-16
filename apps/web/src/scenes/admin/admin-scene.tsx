import { Outlet } from "react-router";
import { adminSceneStyles } from "./admin-scene.style";
import { useShellState } from "../../shell/state";
import { useAdminSession } from "./hooks/use-admin-session";
import { AdminAuth } from "./admin-auth";
import { AdminRail } from "./admin-rail";

// Standalone admin layout (outside the app shell). Owns the auth gate;
// sections render through nested routes (see shell/app-shell.tsx).
export function AdminScene() {
	const { sessionQuery } = useAdminSession();
	const { phase } = useShellState();
	const session = sessionQuery.data;

	const authed = session?.authenticated && !session?.bootstrapRequired;

	return (
		<div className="admin" data-phase={phase}>
			<style jsx>{adminSceneStyles}</style>

			{sessionQuery.isPending ? (
				<main className="admin__body" aria-label="Admin">
					<p className="admin__muted">Loading…</p>
				</main>
			) : !authed && session ? (
				<AdminAuth session={session} />
			) : (
				<div className="admin__layout">
					<AdminRail />
					<main className="admin__main" aria-label="Admin">
						<Outlet />
					</main>
				</div>
			)}
		</div>
	);
}
