import { useCallback, useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./sidebar/sidebar";
import { useCode } from "./code-provider";
import { CheckpointsScreen } from "./chat/screens/checkpoints-screen";
import { CanvasScreen } from "./chat/screens/canvas-screen";
import { TerminalScreen } from "./chat/screens/terminal-screen";
import { CodeShell } from "@/components/blocks/code/code-shell/code-shell";
import { CodeShellBottomPanel } from "@/components/blocks/code/code-shell/code-shell-bottom-panel";
import { CodeShellBottomPanelContent } from "@/components/blocks/code/code-shell/code-shell-bottom-panel-content";
import { CodeShellBottomPanelHeader } from "@/components/blocks/code/code-shell/code-shell-bottom-panel-header";
import { CodeShellMain, CodeShellMainContent } from "@/components/blocks/code/code-shell/code-shell-main";
import { CodeShellSidebar } from "@/components/blocks/code/code-shell/code-shell-sidebar";
import { CodeShellSidebarContent } from "@/components/blocks/code/code-shell/code-shell-sidebar-content";
import { CodeShellSidebarHeader } from "@/components/blocks/code/code-shell/code-shell-sidebar-header";

const SIDEBAR_PANELS = {
  checkpoints: { title: "Checkpoints", Screen: CheckpointsScreen },
  canvas: { title: "Canvas", Screen: CanvasScreen },
};

const SIDEBAR_WIDTH_KEY = "twodb.rightBarSize";
const BOTTOM_PANEL_HEIGHT_KEY = "twodb.bottomPanelHeight";

function readStoredSize(key: string, fallback: number, min: number) {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= min ? raw : fallback;
}

function usePersistedSize(key: string, fallback: number, min: number) {
  const [size, setSize] = useState(() => readStoredSize(key, fallback, min));
  const persist = useCallback(
    (next: number) => {
      setSize(next);
      localStorage.setItem(key, String(Math.round(next)));
    },
    [key],
  );
  return [size, persist] as const;
}

export function CodeScene() {
  const { panel, rightBarVisible, closePanel, toggleRightBar } = useCode();
  const [sidebarWidth, setSidebarWidth] = usePersistedSize(SIDEBAR_WIDTH_KEY, 288, 240);
  const [bottomPanelHeight, setBottomPanelHeight] = usePersistedSize(BOTTOM_PANEL_HEIGHT_KEY, 240, 120);

  const sidebarPanel = panel === "checkpoints" || panel === "canvas" ? SIDEBAR_PANELS[panel] : null;

  return (
    <CodeShell
      sidebarVisible={rightBarVisible}
      sidebarWidth={sidebarWidth}
      onSidebarWidthChange={setSidebarWidth}
      bottomPanelVisible={panel === "terminal"}
      bottomPanelHeight={bottomPanelHeight}
      onBottomPanelHeightChange={setBottomPanelHeight}
    >
      <CodeShellMain>
        <CodeShellMainContent>
          <Outlet />
        </CodeShellMainContent>
        <CodeShellBottomPanel>
          <CodeShellBottomPanelHeader title="Terminal" onClose={closePanel} closeLabel="Close terminal" />
          <CodeShellBottomPanelContent>
            <TerminalScreen />
          </CodeShellBottomPanelContent>
        </CodeShellBottomPanel>
      </CodeShellMain>

      <CodeShellSidebar>
        {sidebarPanel ? (
          <>
            <CodeShellSidebarHeader title={sidebarPanel.title} onClose={closePanel} closeLabel="Close panel" />
            <CodeShellSidebarContent>
              <sidebarPanel.Screen />
            </CodeShellSidebarContent>
          </>
        ) : (
          <>
            <CodeShellSidebarHeader mobileOnly onClose={toggleRightBar} closeLabel="Close sidebar" />
            <CodeShellSidebarContent>
              <Sidebar />
            </CodeShellSidebarContent>
          </>
        )}
      </CodeShellSidebar>
    </CodeShell>
  );
}
