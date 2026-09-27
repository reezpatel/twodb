import { Outlet } from "react-router";
import { NavRail } from "./nav-rail";
import { useAppLayout } from "./use-app-layout";

export function AppLayout() {
  const { session, activeOrg, signOut, switchOrg } = useAppLayout();

  return (
    <div className="bg-background flex h-screen flex-col">
      <div className="flex min-h-0 flex-1">
        <NavRail userName={session?.user.name} userEmail={session?.user.email} orgName={activeOrg?.name} onSwitchOrg={switchOrg} onSignOut={signOut} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <footer className="bg-card text-muted-foreground flex h-6 items-center justify-between border-t px-2 text-xs">
        <span>{activeOrg?.name ?? "twodb"}</span>
        <span>{session?.user.email}</span>
      </footer>
    </div>
  );
}
