import { createElement } from "react";
import type { Preview } from "@storybook/react-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { TooltipProvider } from "../src/components/ui/tooltip";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "../src/index.css";
import "./storybook.css";

const preview: Preview = {
  decorators: [
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
