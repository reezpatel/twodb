export type ViewPluginProvider = {
  priority?: number;
  provides: string;
  hooks?: Record<string, unknown>;
  provider: React.FC<{ children?: React.ReactNode }>;
};

export type ViewPlugin = {
  id: string;

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
};
