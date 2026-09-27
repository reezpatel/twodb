import { useState } from "react";

export type CodeView = "code" | "chat";

export function useCodeScene() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [view, setView] = useState<CodeView>("chat");
  return { selectedSessionId, selectSession: setSelectedSessionId, view, setView };
}
