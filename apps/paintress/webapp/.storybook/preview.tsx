import type { Preview } from "@storybook/react-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "@twodb/blocks/styles.css";
import "@twodb/editor/styles.css";
import "../src/paintress.css";

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
      parentSelector: "html",
      attributeName: "data-theme",
    }),
  ],
  parameters: {
    layout: "centered",
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "var(--paper)" },
        { name: "popover", value: "var(--popover)" },
      ],
    },
  },
};

export default preview;
