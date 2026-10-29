import { createElement } from "react";
import type { Preview } from "@storybook/react-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { CodeChatToolsOpenProvider } from "../src/components/blocks/code/code-chat/code-chat-tools-open";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "../src/index.css";
import "./storybook.css";

const TOOL_OUTPUTS = { expanded: true, collapsed: false } as const;

const preview: Preview = {
  globalTypes: {
    toolOutputs: {
      description: "Expand or collapse every tool row (Cmd/Ctrl+O in the app)",
      toolbar: {
        title: "Tool outputs",
        icon: "collapse",
        dynamicTitle: true,
        items: [
          { value: "default", title: "Tool outputs: per story" },
          { value: "expanded", title: "Expand all" },
          { value: "collapsed", title: "Collapse all" },
        ],
      },
    },
  },
  initialGlobals: { toolOutputs: "default" },
  decorators: [
    (Story, context) =>
      createElement(CodeChatToolsOpenProvider, { open: TOOL_OUTPUTS[context.globals.toolOutputs as keyof typeof TOOL_OUTPUTS] }, createElement(Story)),
    (Story) => createElement(TooltipProvider, { delayDuration: 300 }, createElement(Story)),
    withThemeByClassName({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "dark",
    }),
  ],
  parameters: {
    layout: "fullscreen",
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
