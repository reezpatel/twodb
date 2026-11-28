import { useEffect } from "react";
import { useHeader, type HeaderConfig } from "./HeaderContext.js";

/** Sets the shared TopBar content for the currently-mounted page. */
export function usePageHeader(config: HeaderConfig) {
  const { setConfig } = useHeader();
  const { title, subtitle, actionLabel, onAction } = config;
  useEffect(() => {
    setConfig({ title, subtitle, actionLabel, onAction });
  }, [title, subtitle, actionLabel, onAction, setConfig]);
}

