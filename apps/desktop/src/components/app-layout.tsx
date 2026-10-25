import { useEffect } from "react";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router";
import { ArrowLeftRight, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { AppNavigation } from "./blocks/app-shell/app-navigation";
import { AppSideNavigation } from "./blocks/app-shell/app-side-navigation";
import { AppShell } from "./blocks/app-shell/app-shell";
import { AppShellBody } from "./blocks/app-shell/app-shell-body";
import { AppShellContent } from "./blocks/app-shell/app-shell-content";
import { useAppShellContext } from "./blocks/app-shell/app-shell-context";
import { AppShellWorkspace } from "./blocks/app-shell/app-shell-workspace";
import { SimpleHeader } from "./blocks/app-shell/simple-header";
import { FooterBar } from "./blocks/footer/footer-bar";
import { FooterRunnerResources } from "./blocks/footer/footer-runner-resources";
import { FooterSpaces } from "./blocks/footer/footer-spaces";
import { FooterUsage } from "./blocks/footer/footer-usage";
import { NavRail } from "./blocks/nav-rail/nav-rail";
import { NavRailItem } from "./blocks/nav-rail/nav-rail-item";
import { NavRailSeparator } from "./blocks/nav-rail/nav-rail-separator";
import { NavRailSpacer } from "./blocks/nav-rail/nav-rail-spacer";
import { NavRailUser } from "./blocks/nav-rail/nav-rail-user";
import { SpaceProvider } from "./space-provider";
import { urls } from "../lib/url-registry";
import { useAppLayout } from "./use-app-layout";
import { APPS, SETTINGS_APP, appShellFor, getApp, type AppEntry } from "../lib/apps";

function useActiveAppId(): string | undefined {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/apps\/([^/]+)/);
  return match?.[1];
}

function AppRailItem({ app }: { app: AppEntry }) {
  const navigate = useNavigate();
  const active = useMatch(urls.app(app.id)) !== null;
  return <NavRailItem label={app.label} icon={<app.icon />} active={active} onClick={() => navigate(urls.app(app.id))} />;
}

function CloseNavigationOnAppChange({ appId }: { appId?: string }) {
  const { closeNavigation } = useAppShellContext();
  useEffect(() => closeNavigation(), [appId, closeNavigation]);
  return null;
}

export function AppLayout() {
  const { session, activeOrg, signOut, switchOrg } = useAppLayout();
  const appId = useActiveAppId();
  const app = getApp(appId);
  const Shell = appShellFor(app);
  const Sidenav = app?.Sidenav;

  return (
    <SpaceProvider>
      <AppShell variant="attached">
        <CloseNavigationOnAppChange appId={appId} />
        <SimpleHeader title={app?.label ?? activeOrg?.name ?? "twodb"}>
          <NotificationBell layout="header" />
        </SimpleHeader>

        <AppShellBody>
          <AppShellWorkspace>
            <Shell>
              <AppNavigation>
                <NavRail>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <NavRailUser name={session?.user.name} email={session?.user.email} image={session?.user.image} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
                      <DropdownMenuLabel className="flex flex-col">
                        <span className="text-sm font-medium">{session?.user.name ?? "Account"}</span>
                        <span className="text-muted-foreground text-xs font-normal">{session?.user.email}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={switchOrg}>
                        <ArrowLeftRight />
                        Switch organization
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={signOut}>
                        <LogOut />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <NavRailSeparator />
                  <NotificationBell layout="rail" />
                  {APPS.map((rail) => (
                    <AppRailItem key={rail.id} app={rail} />
                  ))}
                  <NavRailSpacer />
                  <AppRailItem app={SETTINGS_APP} />
                </NavRail>
                <AppSideNavigation>{Sidenav ? <Sidenav /> : null}</AppSideNavigation>
              </AppNavigation>

              <AppShellContent>
                <Outlet />
              </AppShellContent>
            </Shell>
          </AppShellWorkspace>
        </AppShellBody>

        <FooterBar>
          <FooterSpaces />
          <FooterUsage />
          <FooterRunnerResources />
        </FooterBar>
      </AppShell>
    </SpaceProvider>
  );
}
