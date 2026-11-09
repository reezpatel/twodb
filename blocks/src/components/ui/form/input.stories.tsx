import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Blocks/UI/Form/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { placeholder: "San Francisco" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Input className="w-72" {...args} />,
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="location">Location</Label>
      <Input id="location" {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Input className="w-72" {...args} />,
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "not a location" },
  render: (args) => <Input className="w-72" {...args} />,
};
