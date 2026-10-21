import { Outlet } from "react-router";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar/sidebar";
import { useCode, type CodePanelId } from "./code-provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { TerminalScreen } from "./chat/screens/terminal-screen";
import { CheckpointsScreen } from "./chat/screens/checkpoints-screen";
import { ChangesScreen } from "./chat/screens/changes-screen";
import { CanvasScreen } from "./chat/screens/canvas-screen";
import { cn } from "@/lib/utils";

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

  const rightBar = (
    <aside
      className={cn(
        "bg-card border-l flex h-full w-72 shrink-0 flex-col overflow-hidden border-l",
        // Mobile: floats over the content instead of pushing it.
        isMobile && "fixed inset-y-0 right-0 z-40 shadow-xl",
      )}
    >
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
    </aside>
  );

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      {rightBarVisible && rightBar}
    </div>
  );
}