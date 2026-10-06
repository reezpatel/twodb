import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Menu } from "lucide-react";
import { NavRail } from "./nav-rail";
import { MobileNavDrawer } from "./mobile-nav";
import { FooterUsage } from "./footer-usage";
import { MobileNavContext } from "./mobile-nav-context";
import { useAppLayout } from "./use-app-layout";
import { useMediaQuery } from "../lib/use-media-query";

export function AppLayout() {
  const { session, activeOrg, signOut, switchOrg } = useAppLayout();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [navOpen, setNavOpen] = useState(false);
  const [sideNavTarget, setSideNavTarget] = useState<HTMLElement | null>(null);
  const [sideNavActive, setSideNavActive] = useState(false);

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  return (
    <MobileNavContext.Provider value={{ isMobile, closeNav: () => setNavOpen(false), sideNavTarget, setSideNavActive }}>
      <div className="bg-background flex h-screen flex-col">
        {isMobile && (
          <header className="bg-card flex h-12 shrink-0 items-center gap-3 border-b px-3">
            <button
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
            >
              <Menu size={18} />
            </button>
            <span className="truncate text-sm font-semibold">{activeOrg?.name ?? "twodb"}</span>
          </header>
        )}

        <div className="flex min-h-0 flex-1">
          {!isMobile && (
            <NavRail
              userName={session?.user.name}
              userEmail={session?.user.email}
              userImage={session?.user.image}
              onSwitchOrg={switchOrg}
              onSignOut={signOut}
            />
          )}
          <main className="min-w-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        <footer className="bg-card text-muted-foreground flex h-6 items-center justify-between gap-4 border-t px-2 text-xs">
          <div className="flex min-w-0 items-center gap-4">
            <span className="shrink-0">{activeOrg?.name ?? "twodb"}</span>
            <FooterUsage />
          </div>
          <span className="truncate">{session?.user.email}</span>
        </footer>

        {isMobile && (
          <MobileNavDrawer
            open={navOpen}
            onClose={() => setNavOpen(false)}
            hasSideNav={sideNavActive}
            userName={session?.user.name}
            userEmail={session?.user.email}
            userImage={session?.user.image}
            onSwitchOrg={switchOrg}
            onSignOut={signOut}
            sideNavRef={setSideNavTarget}
          />
        )}
      </div>
    </MobileNavContext.Provider>
  );
}
