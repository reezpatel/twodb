import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "../button/button";

const meta = {
  title: "Blocks/UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Tritium target</CardTitle>
        <CardDescription>Cross-section, 1:20</CardDescription>
      </CardHeader>
      <CardContent>Breeds tritium fuel from lithium under neutron bombardment, feeding it back into the plasma loop.</CardContent>
      <CardFooter>
        <Button size="sm">Details</Button>
        <Button size="sm" variant="ghost">
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Hatched: Story = {
  render: () => (
    <Card hatched className="w-80">
      <CardHeader>
        <CardTitle>Cut face</CardTitle>
        <CardDescription>Base slab, section A-A</CardDescription>
      </CardHeader>
      <CardContent>The hatch band marks this panel as a cut or back face in the drawing.</CardContent>
    </Card>
  ),
};

export const BodyOnly: Story = {
  render: () => (
    <Card className="w-72">
      <CardContent>A note panel with body text only — no title block.</CardContent>
    </Card>
  ),
};
