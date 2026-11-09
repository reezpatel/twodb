import { createContext, useContext, type ReactNode } from "react";

const CodeChatToolsOpenContext = createContext<boolean | undefined>(undefined);

type CodeChatToolsOpenProviderProps = {
  /** Undefined leaves every tool on its own default. */
  open?: boolean;
  children: ReactNode;
};

/** The "expand all / collapse all" state for tool rows. Cmd/Ctrl+O sets it in the app; Storybook sets it from the toolbar. */
export function CodeChatToolsOpenProvider({ open, children }: CodeChatToolsOpenProviderProps) {
  return <CodeChatToolsOpenContext.Provider value={open}>{children}</CodeChatToolsOpenContext.Provider>;
}

export function useCodeChatToolsOpen() {
  return useContext(CodeChatToolsOpenContext);
}
