import { AppShell, AppShellBody, AppShellContent, AppShellMain, isLargeViewport } from "@twodb/blocks";
import { useState, type ReactNode } from "react";
import { useRoute } from "../lib/router.js";
import { HeaderProvider, useHeader } from "./HeaderContext.js";
import { SideNav } from "./SideNav.js";
import { TopBar } from "./TopBar.js";

function FrameInner({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(isLargeViewport);
  const route = useRoute();
  const section = route.segments[0] ?? "boards";
  const header = useHeader();

  return (
    <div className="h-dvh">
      <AppShell>
        <AppShellBody>
          <SideNav section={section} open={navOpen} onOpenChange={setNavOpen} />
          <AppShellMain>
            <TopBar
              title={header.config.title}
              subtitle={header.config.subtitle}
              actionLabel={header.config.actionLabel}
              onAction={header.config.onAction}
              navOpen={navOpen}
              onToggleNav={() => setNavOpen((o) => !o)}
            />
            <AppShellContent className="flex flex-col p-0">{children}</AppShellContent>
          </AppShellMain>
        </AppShellBody>
      </AppShell>
    </div>
  );
}

/** App chrome: responsive NavSidebar + TopBar + content area. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <HeaderProvider>
      <FrameInner>{children}</FrameInner>
    </HeaderProvider>
  );
}

