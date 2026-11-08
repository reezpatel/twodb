import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileCode2, FileText, NotebookPen } from "lucide-react";
import { Tabs, type TabData } from "./tabs";

const meta = {
  title: "Blocks/AppShell/Tabs",
  component: Tabs,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const INITIAL_TABS: TabData[] = [
  { value: "reactor", label: "reactor.ts", icon: FileCode2 },
  { value: "target", label: "target.ts", icon: FileCode2 },
  { value: "readme", label: "README.md", icon: FileText },
];

export const Default: Story = {
  args: { tabs: [], activeValue: "", children: null },
  render: () => {
    const [tabs, setTabs] = React.useState<TabData[]>(INITIAL_TABS);
    const [active, setActive] = React.useState("reactor");

    return (
      <div className="h-80 bg-paper">
        <Tabs tabs={tabs} activeValue={active} onChange={setActive} onReorder={setTabs}>
          {(activeValue) =>
            activeValue === "reactor"
              ? "Ion beam source, accelerator and beamline configuration."
              : activeValue === "target"
                ? "Tritium target geometry and cooling loop parameters."
                : "Project notes and diagram conventions."
          }
        </Tabs>
      </div>
    );
  },
};

export const Closable: Story = {
  args: { tabs: [], activeValue: "", children: null },
  render: () => {
    const [tabs, setTabs] = React.useState<TabData[]>(INITIAL_TABS);
    const [active, setActive] = React.useState("reactor");

    const close = (value: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.value !== value);
        if (active === value) setActive(next[0]?.value ?? "");
        return next;
      });
    };

    return (
      <div className="h-80 bg-paper">
        <Tabs tabs={tabs} activeValue={active} onChange={setActive} onClose={close} onReorder={setTabs}>
          {(activeValue) => (tabs.find((t) => t.value === activeValue) ? `Content for ${tabs.find((t) => t.value === activeValue)!.label}.` : "No tabs open.")}
        </Tabs>
      </div>
    );
  },
};

export const WithAttention: Story = {
  args: { tabs: [], activeValue: "", children: null },
  render: () => {
    const [tabs, setTabs] = React.useState<TabData[]>([
      { value: "reactor", label: "reactor.ts", icon: FileCode2, attention: "warning" },
      { value: "target", label: "target.ts", icon: FileCode2, attention: "danger" },
      { value: "readme", label: "README.md", icon: FileText, attention: "success" },
      { value: "notes", label: "notes.md", icon: NotebookPen, attention: "info" },
    ]);
    const [active, setActive] = React.useState("reactor");

    const close = (value: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.value !== value);
        if (active === value) setActive(next[0]?.value ?? "");
        return next;
      });
    };

    return (
      <div className="h-80 bg-paper">
        <Tabs tabs={tabs} activeValue={active} onChange={setActive} onClose={close} onReorder={setTabs}>
          {(activeValue) => {
            switch (activeValue) {
              case "reactor":
                return "Unsaved changes (warning).";
              case "target":
                return "Build failed (danger).";
              case "readme":
                return "Review approved (success).";
              case "notes":
                return "New comment (info).";
              default:
                return "No tabs open.";
            }
          }}
        </Tabs>
      </div>
    );
  },
};

export const WithAddButton: Story = {
  args: { tabs: [], activeValue: "", children: null },
  render: () => {
    const [tabs, setTabs] = React.useState<TabData[]>(INITIAL_TABS);
    const [active, setActive] = React.useState("reactor");
    const counter = React.useRef(tabs.length + 1);

    const close = (value: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.value !== value);
        if (active === value) setActive(next[0]?.value ?? "");
        return next;
      });
    };

    const add = () => {
      const value = `scratch-${counter.current}`;
      counter.current += 1;
      setTabs((prev) => [...prev, { value, label: `${value}.ts`, icon: FileCode2 }]);
      setActive(value);
    };

    return (
      <div className="h-80 bg-paper">
        <Tabs tabs={tabs} activeValue={active} onChange={setActive} onClose={close} onReorder={setTabs} onAdd={add}>
          {(activeValue) => (tabs.find((t) => t.value === activeValue) ? `Content for ${tabs.find((t) => t.value === activeValue)!.label}.` : "No tabs open.")}
        </Tabs>
      </div>
    );
  },
};
