import { Group, Panel, Separator } from "react-resizable-panels";
import { useState } from "react";
import { Outlet } from "react-router";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar/sidebar";
import { useCode, type CodePanelId } from "./code-provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { TerminalScreen } from "./chat/screens/terminal-screen";
import { CheckpointsScreen } from "./chat/screens/checkpoints-screen";
import { ChangesScreen } from "./chat/screens/changes-screen";
import { CanvasScreen } from "./chat/screens/canvas-screen";

const PANEL_TITLES: Record<CodePanelId, string> = {
  terminal: "Terminal",
  checkpoints: "Checkpoints",
  changes: "Changes",
  canvas: "Canvas",
};

export function PanelBody({ panel }: { panel: CodePanelId }) {
  // The screens read :sessionId from the route — they render the same inside
  // the right bar; the main column's route stub renders nothing.
  switch (panel) {
    case "terminal":
      return <TerminalScreen />;
    case "checkpoints":
      return <CheckpointsScreen />;
    case "changes":
      return <ChangesScreen />;
    case "canvas":
      return <CanvasScreen />;
  }
}

export function CodeScene() {
  useCode(); // CodeProvider (rendered by the app shell) owns the chat panel state.
  const { panel, rightBarVisible, closePanel, toggleRightBar } = useCode();
  const isMobile = useMediaQuery("(max-width: 1279px)");

  // Persisted right-bar size in px (react-resizable-panels v4 Group layout).
  const [barSize, setBarSize] = useState(() => {
    const raw = Number(localStorage.getItem("twodb.rightBarSize"));
    return Number.isFinite(raw) && raw >= 240 && raw <= 720 ? raw : 288;
  });

  const rightBarContents = (
    <>
      {panel ? (
        <>
          <header className="border-b flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">{PANEL_TITLES[panel]}</span>
            <button
              aria-label="Close panel"
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md"
              onClick={closePanel}
            >
              <X size={14} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PanelBody panel={panel} />
          </div>
        </>
      ) : (
        <>
          {/* The floating mobile overlay has no nearby toggle when no panel is
              open (the chat header button is underneath it) — give the default
              sections sidebar its own close row. Desktop keeps the bar in-flow
              and toggled from the chat header. */}
          {isMobile && (
            <header className="border-b flex items-center justify-end border-b px-3 py-2">
              <button
                aria-label="Close sidebar"
                title="Close sidebar"
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md"
                onClick={toggleRightBar}
              >
                <X size={14} />
              </button>
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Sidebar />
          </div>
        </>
      )}
    </>
  );

  if (isMobile) {
    // Mobile: the bar floats over the content instead of pushing it — no
    // panel group, no resize.
    return (
      <div className="relative flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
        {rightBarVisible && (
          <aside className="bg-card border-l fixed inset-y-0 right-0 z-40 flex h-full w-[90%] max-w-[900px] shrink-0 flex-col overflow-hidden border-l shadow-xl">
            {rightBarContents}
          </aside>
        )}
      </div>
    );
  }

  // Desktop: resizable split — chat area | right bar (react-resizable-panels).
  return (
    <Group orientation="horizontal" className="h-full min-h-0">
      <Panel minSize="40%" className="flex min-w-0 flex-col">
        <Outlet />
      </Panel>
      {rightBarVisible && (
        <>
          <Separator className="bg-border hover:bg-primary/60 w-px cursor-col-resize transition-colors" />
          <Panel
            defaultSize={barSize}
            minSize={240}
            maxSize={720}
            onResize={(size) => {
              // inPixels — persist the px width; clamped by min/max props.
              if (typeof size === "object" && size.inPixels) {
                setBarSize(size.inPixels);
                localStorage.setItem("twodb.rightBarSize", String(Math.round(size.inPixels)));
              }
            }}
            className="flex min-w-0 flex-col"
          >
            <aside className="bg-card border-l flex h-full min-h-0 w-full flex-col overflow-hidden border-l">{rightBarContents}</aside>
          </Panel>
        </>
      )}
    </Group>
  );
}