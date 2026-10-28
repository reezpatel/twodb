import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Braces, Cloud, Database, GitBranch, MessageSquare, Palette, PanelRight, Terminal } from "lucide-react";
import { CodeHeaderWorking } from "./code-header-working";
import { CodeHeader } from "./code-header";
import { CodeHeaderTab, CodeHeaderTabs } from "./code-header-tabs";
import { CodeHeaderAction, CodeHeaderActions } from "./code-header-actions";
import { CodeHeaderStatus } from "./code-header-status";
import { CodeHeaderSeparator } from "./code-header-separator";
import { CodeHeaderWidget, CodeHeaderWidgets } from "./code-header-widgets";

const meta = {
  title: "Blocks/Code/CodeHeader",
  component: CodeHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const TABS = [
  { id: "chat", label: "Chat", icon: <MessageSquare /> },
  { id: "editor", label: "Editor", icon: <Braces /> },
  { id: "terminal", label: "Terminal", icon: <Terminal /> },
  { id: "checkpoints", label: "Checkpoints", icon: <GitBranch /> },
  { id: "canvas", label: "Canvas", icon: <Palette /> },
];

type PreviewProps = {
  modifier: string;
  working?: boolean;
  status?: "live" | "connecting" | "offline";
};

function Preview({ modifier, working = false, status = "live" }: PreviewProps) {
  const [active, setActive] = useState("chat");
  const [panelVisible, setPanelVisible] = useState(true);

  return (
    <CodeHeader>
      <CodeHeaderTabs>
        {TABS.map((tab, index) => (
          <CodeHeaderTab
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            shortcut={[modifier, String(index + 1)]}
            active={active === tab.id}
            onClick={() => setActive(tab.id)}
          />
        ))}
      </CodeHeaderTabs>
      <CodeHeaderSeparator />
      <CodeHeaderWidgets>
        <CodeHeaderWidget icon={<Cloud />} label="AWS SSO — profile dev-account" active />
        <CodeHeaderWidget icon={<Database />} label="Database — not connected" />
      </CodeHeaderWidgets>
      <CodeHeaderActions>
        {working ? <CodeHeaderWorking label="working · round 3" /> : null}
        <CodeHeaderStatus status={status} label={status === "connecting" ? "Reconnecting" : "Disconnected"} />
        <CodeHeaderAction
          icon={<PanelRight />}
          label={panelVisible ? "Hide right panel" : "Show right panel"}
          shortcut={[modifier, "B"]}
          active={panelVisible}
          onClick={() => setPanelVisible((value) => !value)}
        />
      </CodeHeaderActions>
    </CodeHeader>
  );
}

export const Mac: Story = {
  render: () => <Preview modifier="⌘" />,
};

export const Windows: Story = {
  render: () => <Preview modifier="Ctrl" />,
};

export const Working: Story = {
  render: () => <Preview modifier="⌘" working />,
};

export const Reconnecting: Story = {
  render: () => <Preview modifier="⌘" status="connecting" />,
};

export const Disconnected: Story = {
  render: () => <Preview modifier="⌘" status="offline" />,
};

export const WidgetLoading: Story = {
  render: () => (
    <CodeHeader>
      <CodeHeaderWidgets>
        <CodeHeaderWidget icon={<Cloud />} label="AWS SSO — signing in" loading />
        <CodeHeaderWidget icon={<Cloud />} label="AWS SSO — authenticated" active />
        <CodeHeaderWidget icon={<Cloud />} label="AWS SSO — click to authenticate" />
      </CodeHeaderWidgets>
    </CodeHeader>
  ),
};
