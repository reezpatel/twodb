import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip, CHIP_ZONES, CHIP_TONES } from "./chip";

const meta = {
  title: "Blocks/UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    children: "Ion beam",
  },
  argTypes: {
    zone: { control: "select", options: [undefined, ...CHIP_ZONES] },
    tone: { control: "select", options: ["none", ...CHIP_TONES] },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  args: { zone: "ion" },
};

export const Selected: Story = {
  args: { zone: "ion", selected: true },
};

export const NoZoneDot: Story = {
  args: { children: "All parts" },
};

export const Info: Story = {
  args: { tone: "info", children: "Informational" },
};

export const Danger: Story = {
  args: { tone: "danger", children: "Danger" },
};

export const Success: Story = {
  args: { tone: "success", children: "Success" },
};

export const Warning: Story = {
  args: { tone: "warning", children: "Warning" },
};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 bg-paper p-6">
      <Chip tone="info">Info</Chip>
      <Chip tone="danger">Danger</Chip>
      <Chip tone="success">Success</Chip>
      <Chip tone="warning">Warning</Chip>
    </div>
  ),
};

export const FilterGroup: Story = {
  render: () => {
    const items = [
      { label: "Ion beam", zone: "ion" as const },
      { label: "Tritium target", zone: "tritium" as const },
      { label: "Transmutation", zone: "transmute" as const },
      { label: "Materials testing", zone: "materials" as const },
    ];
    const [active, setActive] = React.useState("Ion beam");
    return (
      <div className="flex flex-wrap gap-3 bg-paper p-6">
        {items.map((item) => (
          <Chip key={item.label} zone={item.zone} selected={active === item.label} onClick={() => setActive(item.label)}>
            {item.label}
          </Chip>
        ))}
      </div>
    );
  },
};
