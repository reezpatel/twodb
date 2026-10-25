import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

function withoutPwaPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin) => {
    if (Array.isArray(plugin)) return withoutPwaPlugins(plugin);
    if (!plugin) return [];
    if ("name" in plugin && plugin.name.startsWith("vite-plugin-pwa")) return [];
    return [plugin];
  });
}

const config: StorybookConfig = {
  stories: ["../src/components/{blocks,ui}/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = withoutPwaPlugins(viteConfig.plugins ?? []);
    return viteConfig;
  },
};

export default config;
