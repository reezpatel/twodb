import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";

const meta = {
  title: "Blocks/UI/Form/RadioGroup",
  component: RadioGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="ion">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="ion" id="r-ion" />
        <Label htmlFor="r-ion">Ion beam</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tritium" id="r-tritium" />
        <Label htmlFor="r-tritium">Tritium target</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="transmute" id="r-transmute" />
        <Label htmlFor="r-transmute">Transmutation target</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="ion" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="ion" id="rd-ion" />
        <Label htmlFor="rd-ion">Ion beam</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tritium" id="rd-tritium" />
        <Label htmlFor="rd-tritium">Tritium target</Label>
      </div>
    </RadioGroup>
  ),
};
