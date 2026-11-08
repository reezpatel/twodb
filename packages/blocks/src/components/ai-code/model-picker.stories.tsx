import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bot, Sparkles, Zap } from "lucide-react";
import { ModelPicker, type ModelProvider } from "./model-picker";

const meta = {
  title: "Blocks/AICode/ModelPicker",
  component: ModelPicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof ModelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const PROVIDERS: ModelProvider[] = [
  { id: "anthropic", title: "Anthropic", icon: Sparkles, models: [
    { id: "opus-4.5", label: "Claude Opus 4.5", context: "200k", thinking: true },
    { id: "sonnet-4.5", label: "Claude Sonnet 4.5", context: "200k", thinking: true },
    { id: "haiku-4.5", label: "Claude Haiku 4.5", context: "200k" },
  ]},
  { id: "openai", title: "OpenAI", icon: Bot, models: [
    { id: "gpt-5.2", label: "GPT-5.2", context: "256k", thinking: true },
    { id: "gpt-5-mini", label: "GPT-5 mini", context: "128k" },
  ]},
  { id: "google", title: "Google", icon: Zap, models: [
    { id: "gemini-3-pro", label: "Gemini 3 Pro", context: "1M", thinking: true },
    { id: "gemini-3-flash", label: "Gemini 3 Flash", context: "1M" },
  ]},
];

export const Default: Story = {
  args: { providers: PROVIDERS, value: "sonnet-4.5" },
  render: (args) => {
    const [value, setValue] = React.useState(args.value);
    return (
      <div className="p-6">
        <ModelPicker {...args} value={value} onChange={setValue} />
        <p className="mt-3 text-[12px] text-muted-foreground">Selected: {value}</p>
      </div>
    );
  },
};

export const FlatList: Story = {
  args: { models: ["opus-4.5", "sonnet-4.5", "haiku-4.5"], value: "sonnet-4.5" },
  render: (args) => {
    const [value, setValue] = React.useState(args.value);
    return (
      <div className="p-6">
        <ModelPicker {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};
