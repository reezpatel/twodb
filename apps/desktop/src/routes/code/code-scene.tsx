import { useCallback, useState } from "react";
import { Outlet } from "react-router";
import { X } from "lucide-react";
import { Resizable } from "re-resizable";
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

function readStoredWidth(key: string, fallback: number, min: number, max: number) {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback;
}

export function CodeScene() {
  useCode(); // CodeProvider (rendered by the app shell) owns the chat panel state.
  const { panel, rightBarVisible, closePanel, toggleRightBar } = useCode();
  const isMobile = useMediaQuery("(max-width: 1279px)");

  // Persisted right-bar width in px (re-resizable drag handle on its left edge).
  const [barWidth, setBarWidth] = useState(() => readStoredWidth("twodb.rightBarSize", 288, 240, 720));
  const persistBarWidth = useCallback((w: number) => {
    const clamped = Math.min(720, Math.max(240, w));
    setBarWidth(clamped);
    localStorage.setItem("twodb.rightBarSize", String(Math.round(clamped)));
  }, []);

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
    // resize handle, fixed 90% width.
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

  // Desktop: chat area flexes; the right bar is a px-width Resizable whose
  // drag handle is its left edge. Sibling widths stay in sync because the
  // chat column is flex-1 and re-resizable sets an explicit width.
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      {rightBarVisible && (
        <Resizable
          size={{ width: barWidth, height: "100%" }}
          minWidth={240}
          maxWidth={720}
          enable={{ left: true }}
          handleComponent={{
            left: (
              <div className="bg-border hover:bg-primary/60 group absolute inset-y-0 left-0 z-10 flex w-1 -translate-x-1/2 cursor-col-resize items-center justify-center transition-colors" title="Drag to resize" />
            ),
          }}
          handleStyles={{ left: { width: "5px", left: "-2px", height: "100%", cursor: "col-resize" } }}
          onResizeStop={(_e, _dir, _ref, d) => persistBarWidth(barWidth + d.width)}
          className="bg-card border-l flex shrink-0 flex-col overflow-hidden border-l"
        >
          {rightBarContents}
        </Resizable>
      )}
    </div>
  );
}
