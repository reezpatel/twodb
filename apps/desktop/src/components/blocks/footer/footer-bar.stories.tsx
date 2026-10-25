import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bot, Boxes, MonitorCog } from "lucide-react";
import { FooterBar } from "./footer-bar";
import { FooterWidget } from "./footer-widget";

const meta = {
  title: "Blocks/Footer/FooterBar",
  component: FooterBar,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FooterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="bg-background p-4">
      <FooterBar>
        <FooterWidget aria-label="Spaces" icon={<Boxes size={13} />}>
          All spaces
        </FooterWidget>
        <FooterWidget aria-label="LLM usage" icon={<Bot size={13} />}>
          Weekly 24%
        </FooterWidget>
        <FooterWidget aria-label="Runner resources" icon={<MonitorCog size={13} />}>
          Local runner CPU 18%
        </FooterWidget>
      </FooterBar>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="bg-background p-4">
      <FooterBar>
        <FooterWidget aria-label="Default" icon={<Boxes size={13} />}>
          Default
        </FooterWidget>
        <FooterWidget aria-label="Primary" icon={<Bot size={13} />} variant="primary">
          Primary
        </FooterWidget>
        <FooterWidget aria-label="Secondary" icon={<Bot size={13} />} variant="secondary">
          Secondary
        </FooterWidget>
        <FooterWidget aria-label="Info" icon={<MonitorCog size={13} />} variant="info">
          Info
        </FooterWidget>
        <FooterWidget aria-label="Warning" icon={<MonitorCog size={13} />} variant="warn">
          Warning
        </FooterWidget>
        <FooterWidget aria-label="Error" icon={<MonitorCog size={13} />} variant="error">
          Error
        </FooterWidget>
        <FooterWidget aria-label="Success" icon={<MonitorCog size={13} />} variant="success">
          Success
        </FooterWidget>
        <FooterWidget aria-label="Inverse" icon={<MonitorCog size={13} />} variant="inverse">
          Inverse
        </FooterWidget>
      </FooterBar>
    </div>
  ),
};
