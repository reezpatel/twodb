import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Sidebar } from "@twodb/blocks";
import { ShellChrome } from "./ShellChrome.js";
import { useSidebarToggle } from "../hooks/useSidebarToggle.js";
import { useDetailPanel } from "../hooks/useDetailPanel.js";
import type { Connection } from "../../../lib/tworoute-client.js";

const connections: Connection[] = [
  { id: "1", spaceId: "s1", spaceIds: ["s1"], name: "openai-prod", provider: "openai", baseUrl: "https://api.openai.com", defaultModel: "gpt-5", createdAt: "" },
  { id: "2", spaceId: "s1", spaceIds: ["s1"], name: "claude-main", provider: "anthropic", baseUrl: "https://api.anthropic.com", defaultModel: null, createdAt: "" },
  { id: "3", spaceId: "s2", spaceIds: ["s2"], name: "local-ollama", provider: "ollama", baseUrl: "http://localhost:11434", defaultModel: null, createdAt: "" },
];

/**
 * The app shell exactly as App.tsx wires it: the nav docks inline on lg+
 * (preference persisted) and floats as a backdrop sheet below lg (ephemeral,
 * starts closed, closes on selection). Narrow the browser under 1024px and
 * use the header toggle to open the sheet.
 */
function ShellHarness() {
  const { open, toggle, setOpen, overlay } = useSidebarToggle("story.tworoute.nav-open");
  const detail = useDetailPanel();
  // Storybook's Tailwind scan misses app-only classes (lg:hidden,
  // max-lg:w-[85vw]) — the app build generates them; here they go inline.
  const [isMobile, setIsMobile] = React.useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsMobile(!mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const [activeId, setActiveId] = React.useState("dashboard");
  const onConnection = activeId !== "dashboard";
  return (
    // Inline style: the repo storybook's Tailwind scan only covers blocks'
    // sources, so novel arbitrary classes in app stories wouldn't generate.
    <div style={{ height: 560 }}>
      <ShellChrome
        connections={connections}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          if (overlay) setOpen(false);
        }}
        userName="Ada Lovelace"
        onSignOut={() => {}}
        canInstall
        onInstall={() => {}}
        navOpen={open}
        onToggleNav={toggle}
        onNavOpenChange={setOpen}
        header={
          <>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold leading-none text-ink">
                {activeId === "dashboard" ? "Dashboard" : activeId}
              </h1>
            </div>
            {onConnection && isMobile ? (
              <Button size="sm" variant="ghost" aria-expanded={detail.open} onClick={detail.toggle}>
                Details
              </Button>
            ) : null}
          </>
        }
        sidebar={
          onConnection ? (
            <Sidebar
              side="right"
              variant="responsive"
              open={detail.open}
              onOpenChange={detail.setOpen}
              defaultWidth={320}
              resizable={false}
              className="border-l border-outline bg-card"
              style={isMobile ? { width: "85vw" } : undefined}
            >
              <div className="p-4 text-[13px] text-ink-muted">
                Detail panel for <span className="font-semibold text-ink">{activeId}</span>. Docked on lg+; below lg it
                floats at 85vw and starts closed — the header "Details" button toggles it.
              </div>
            </Sidebar>
          ) : undefined
        }
      >
        <div className="p-4 text-[13px] text-ink-muted sm:p-6">
          Main content for <span className="font-semibold text-ink">{activeId}</span>. Resize the browser across
          1024px: above it the nav pushes this pane; below it floats as a sheet with a backdrop (Escape or backdrop
          click closes it). Pick a connection to see the right detail panel.
        </div>
      </ShellChrome>
    </div>
  );
}

const meta = {
  title: "TwoRoute/Shell/ShellChrome",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ShellHarness />,
};
