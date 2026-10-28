import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeShell } from "./code-shell";
import { CodeShellMain, CodeShellMainContent } from "./code-shell-main";
import { CodeShellBottomPanel } from "./code-shell-bottom-panel";
import { CodeShellBottomPanelContent } from "./code-shell-bottom-panel-content";
import { CodeShellBottomPanelHeader } from "./code-shell-bottom-panel-header";
import { CodeShellSidebar } from "./code-shell-sidebar";
import { CodeShellSidebarContent } from "./code-shell-sidebar-content";
import { CodeShellSidebarHeader } from "./code-shell-sidebar-header";

const meta = {
  title: "Blocks/Code/CodeShell",
  component: CodeShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeShell>;

export default meta;
type Story = StoryObj<typeof meta>;

type PreviewProps = {
  initialVisible?: boolean;
  panelTitle?: string;
};

function Preview({ initialVisible = true, panelTitle }: PreviewProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [width, setWidth] = useState(288);

  return (
    <div className="bg-background h-screen">
      <CodeShell sidebarVisible={visible} sidebarWidth={width} onSidebarWidthChange={setWidth}>
        <CodeShellMain>
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-semibold">Chat</span>
            <Button size="sm" variant="outline" onClick={() => setVisible((value) => !value)}>
              {visible ? "Hide" : "Show"} sidebar
            </Button>
          </div>
          <div className="text-muted-foreground flex-1 p-4 text-sm">Main column. Width: {width}px</div>
        </CodeShellMain>

        <CodeShellSidebar>
          <CodeShellSidebarHeader
            title={panelTitle}
            mobileOnly={!panelTitle}
            onClose={() => setVisible(false)}
            closeLabel={panelTitle ? "Close panel" : "Close sidebar"}
          />
          <CodeShellSidebarContent>
            <p className="text-muted-foreground p-4 text-sm">{panelTitle ? `${panelTitle} panel content` : "Sections sidebar content"}</p>
          </CodeShellSidebarContent>
        </CodeShellSidebar>
      </CodeShell>
    </div>
  );
}

export const Sections: Story = {
  render: () => <Preview />,
};

export const Panel: Story = {
  render: () => <Preview panelTitle="Terminal" />,
};

export const Hidden: Story = {
  render: () => <Preview initialVisible={false} />,
};

function BottomPanelPreview() {
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelHeight, setPanelHeight] = useState(240);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(288);

  return (
    <div className="bg-background h-screen">
      <CodeShell
        sidebarVisible={sidebarVisible}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        bottomPanelVisible={panelVisible}
        bottomPanelHeight={panelHeight}
        onBottomPanelHeightChange={setPanelHeight}
      >
        <CodeShellMain>
          <CodeShellMainContent>
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <span className="flex-1 text-sm font-semibold">Chat</span>
              <Button size="sm" variant="outline" onClick={() => setPanelVisible((value) => !value)}>
                {panelVisible ? "Hide" : "Show"} terminal
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSidebarVisible((value) => !value)}>
                {sidebarVisible ? "Hide" : "Show"} sidebar
              </Button>
            </div>
            <div className="text-muted-foreground flex-1 overflow-auto p-4 text-sm">Main content. Terminal height: {panelHeight}px</div>
          </CodeShellMainContent>

          <CodeShellBottomPanel>
            <CodeShellBottomPanelHeader title="Terminal" onClose={() => setPanelVisible(false)} />
            <CodeShellBottomPanelContent>
              <pre className="text-muted-foreground p-3 font-mono text-xs">$ pnpm local</pre>
            </CodeShellBottomPanelContent>
          </CodeShellBottomPanel>
        </CodeShellMain>

        <CodeShellSidebar>
          <CodeShellSidebarHeader title="Sections" onClose={() => setSidebarVisible(false)} />
          <CodeShellSidebarContent>
            <p className="text-muted-foreground p-4 text-sm">Sidebar spans the full height.</p>
          </CodeShellSidebarContent>
        </CodeShellSidebar>
      </CodeShell>
    </div>
  );
}

export const WithBottomPanel: Story = {
  render: () => <BottomPanelPreview />,
};
