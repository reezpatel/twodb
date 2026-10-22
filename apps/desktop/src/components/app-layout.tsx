import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Menu } from "lucide-react";
import { NavRail } from "./nav-rail";
import { MobileNavDrawer } from "./mobile-nav";
import { FooterUsage } from "./footer-usage";
import { FooterRunnerResources } from "./footer-runner-resources";
import { FooterSpaces } from "./footer-spaces";
import { MobileNavContext } from "./mobile-nav-context";
import { SpaceProvider } from "./space-provider";
import { useAppLayout } from "./use-app-layout";
import { useMediaQuery } from "../lib/use-media-query";
import { appShellFor, getApp } from "../lib/apps";

function useActiveAppId(): string | undefined {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/apps\/([^/]+)/);
  return match?.[1];
}

export function AppLayout() {
  const { session, activeOrg, signOut, switchOrg } = useAppLayout();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [navOpen, setNavOpen] = useState(false);
  const [sideNavTarget, setSideNavTarget] = useState<HTMLElement | null>(null);
  const [sideNavActive, setSideNavActive] = useState(false);

  const appId = useActiveAppId();
  const app = getApp(appId);
  const Shell = appShellFor(app);
  const Sidenav = app?.Sidenav;

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  // Switching apps closes the drawer; the new app's sidenav replaces the portal content.
  useEffect(() => {
    setNavOpen(false);
  }, [appId]);

  return (
    <SpaceProvider>
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
            <span className="truncate text-sm font-semibold">{app?.label ?? activeOrg?.name ?? "twodb"}</span>
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
          <Shell>
            {/* Desktop: the app's sidenav is a column beside the content.
                Mobile: SideNav portals itself into the floating drawer, so
                nothing renders here and the main panel stays clean. */}
            <div className="flex h-full min-h-0 min-w-0 flex-1">
              {Sidenav ? <Sidenav /> : null}
              <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                <Outlet />
              </main>
            </div>
          </Shell>
        </div>

        <footer className="bg-card text-muted-foreground flex h-6 items-center justify-between gap-4 border-t px-2 text-xs">
          <div className="flex min-w-0 items-center gap-4">
            <FooterSpaces />
            <FooterUsage />
            <FooterRunnerResources />
          </div>
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
    </SpaceProvider>
  );
}
