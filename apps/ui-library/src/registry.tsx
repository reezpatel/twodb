import type { ReactNode } from "react";
import { Button, Card, Input, Badge } from "@twodb/ui";

export interface Story {
  title: string;
  render: () => ReactNode;
  code: string;
}

export interface ComponentEntry {
  name: string;
  description: string;
  stories: Story[];
}

export const registry: ComponentEntry[] = [
  {
    name: "Button",
    description: "Action button with variants and sizes.",
    stories: [
      {
        title: "Variants",
        render: () => (
          <div className="row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        ),
        code: `<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>`,
      },
      {
        title: "Sizes",
        render: () => (
          <div className="row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        ),
        code: `<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`,
      },
      {
        title: "Disabled",
        render: () => <Button disabled>Disabled</Button>,
        code: `<Button disabled>Disabled</Button>`,
      },
    ],
  },
  {
    name: "Card",
    description: "Container with optional title for grouping content.",
    stories: [
      {
        title: "Default",
        render: () => (
          <Card title="Getting started">
            Cards group related content in a bordered surface.
          </Card>
        ),
        code: `<Card title="Getting started">
  Cards group related content in a bordered surface.
</Card>`,
      },
      {
        title: "Without title",
        render: () => <Card>A card with just body content.</Card>,
        code: `<Card>A card with just body content.</Card>`,
      },
    ],
  },
  {
    name: "Input",
    description: "Text input with an optional label.",
    stories: [
      {
        title: "With label",
        render: () => <Input label="Email" type="email" placeholder="ada@example.com" />,
        code: `<Input label="Email" type="email" placeholder="ada@example.com" />`,
      },
      {
        title: "Bare",
        render: () => <Input placeholder="No label" />,
        code: `<Input placeholder="No label" />`,
      },
    ],
  },
  {
    name: "Badge",
    description: "Small status pill in several tones.",
    stories: [
      {
        title: "Tones",
        render: () => (
          <div className="row">
            <Badge>Neutral</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
          </div>
        ),
        code: `<Badge>Neutral</Badge>
<Badge tone="success">Success</Badge>
<Badge tone="warning">Warning</Badge>
<Badge tone="danger">Danger</Badge>`,
      },
    ],
  },
];
