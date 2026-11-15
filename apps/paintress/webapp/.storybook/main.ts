import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Icons/assets load from the Paintress API — proxy it like the app's vite config
  // does, so icon stories render the real glyphs when a server is running.
  viteFinal: (config) => {
    const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
    config.resolve = config.resolve ?? {};
    config.resolve.dedupe = [...(config.resolve.dedupe ?? []), "react", "react-dom"];
    config.server = config.server ?? {};
    config.server.proxy = {
      ...(config.server.proxy ?? {}),
      "/paintress-api": {
        target: gateway,
        changeOrigin: true,
        ws: true,
        rewrite: (p: string) => p.replace(/^\/paintress-api/, "/apps/paintress"),
      },
    };
    return config;
  },
};

export default config;
