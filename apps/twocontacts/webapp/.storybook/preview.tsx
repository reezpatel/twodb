import type { Preview } from "@storybook/react-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "@twodb/blocks/styles.css";

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
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "var(--paper)" },
        { name: "card", value: "var(--card)" },
      ],
    },
  },
};

export default preview;
