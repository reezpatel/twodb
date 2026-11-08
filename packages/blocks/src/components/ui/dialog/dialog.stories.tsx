import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "../button/button";
import { Label } from "../form/label";
import { Input } from "../form/input";

const meta = {
  title: "Blocks/UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusion reactor</DialogTitle>
          <DialogDescription>Cross-section, 1:20. Confirm the details before publishing this diagram.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Edit location</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>Update the place this diagram is set in.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dlg-location">Location</Label>
          <Input id="dlg-location" defaultValue="San Francisco" />
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
