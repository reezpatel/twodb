export type ViewPluginProvider = {
  priority?: number;
  provides: string;
  hooks?: Record<string, unknown>;
  provider: React.FC<{ children?: React.ReactNode }>;
};

export type ViewPluginFunction = (...args: unknown[]) => unknown;

export type PluginNavItem = {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
};

export type ViewPluginInitContext = {
  pluginId: string;
  invoke: (name: string, ...args: unknown[]) => unknown;
  addFunction: (name: string, fn: ViewPluginFunction) => void;
  addNavItem: (item: PluginNavItem) => void;
  emit: (event: { type: string; [key: string]: unknown }) => void;
  on: (type: string, listener: (event: { type: string; [key: string]: unknown }) => void) => void;
};

export type ViewPluginRouteProps = {
  path: string;
  navigate: (path: string) => void;
};

export type ViewPlugin = {
  id: string;
  name?: string;

  providers?: Array<ViewPluginProvider>;

  admin?: {
    settings?: React.FC<{
      config: unknown;
      setConfig: (data: unknown) => Promise<{ success: boolean; errors?: string[] }>;
    }>;
  };

  workspace?: {
    settings?: React.ReactNode;
  };

  routes?: Record<string, React.FC<ViewPluginRouteProps>>;

  functions?: Record<string, ViewPluginFunction>;

  init?: (ctx: ViewPluginInitContext) => void | Promise<void>;
};
