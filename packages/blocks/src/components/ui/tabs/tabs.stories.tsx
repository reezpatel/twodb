import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, ShieldCheck, UserRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta = {
  title: "Blocks/UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "security", label: "Security", icon: ShieldCheck },
  { value: "notifications", label: "Notifications", icon: Bell },
];

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="profile">
      <TabsList>
        {ITEMS.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            <i.icon /> {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="profile">Profile settings.</TabsContent>
      <TabsContent value="security">Security settings.</TabsContent>
      <TabsContent value="notifications">Notification preferences.</TabsContent>
    </Tabs>
  ),
};

export const Button: Story = {
  render: () => (
    <Tabs defaultValue="profile">
      <TabsList variant="button">
        {ITEMS.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            <i.icon /> {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  ),
};

export const Line: Story = {
  render: () => (
    <Tabs defaultValue="profile">
      <TabsList variant="line">
        {ITEMS.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            <i.icon /> {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="profile">Profile settings.</TabsContent>
      <TabsContent value="security">Security settings.</TabsContent>
    </Tabs>
  ),
};

export const Pill: Story = {
  render: () => (
    <Tabs defaultValue="profile">
      <TabsList shape="pill">
        {ITEMS.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            <i.icon /> {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-6">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Tabs key={size} defaultValue="profile">
          <TabsList size={size}>
            {ITEMS.map((i) => (
              <TabsTrigger key={i.value} value={i.value}>
                <i.icon /> {i.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ))}
    </div>
  ),
};
