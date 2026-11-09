import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { Checkbox } from "./checkbox";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Switch } from "./switch";
import { Button } from "../button/button";
import { Card, CardContent, CardHeader, CardTitle } from "../card/card";

const meta = {
  title: "Blocks/UI/Form/Sample form",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Fusion reactor</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="f-name">Name</Label>
          <Input id="f-name" placeholder="Fusion reactor" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-location">Location</Label>
          <Input id="f-location" placeholder="San Francisco" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-notes">Notes</Label>
          <Textarea id="f-notes" placeholder="Cross-section, 1:20" />
        </div>
        <div className="grid gap-2">
          <Label>Primary zone</Label>
          <RadioGroup defaultValue="ion">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ion" id="f-ion" />
              <Label htmlFor="f-ion">Ion beam</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="tritium" id="f-tritium" />
              <Label htmlFor="f-tritium">Tritium target</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="f-published" defaultChecked />
          <Label htmlFor="f-published">Published</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="f-grid" defaultChecked />
          <Label htmlFor="f-grid">Show grid paper</Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
          <Button size="sm">Save</Button>
        </div>
      </CardContent>
    </Card>
  ),
};
