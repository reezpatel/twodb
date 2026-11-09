import { useChat } from "./use-chat-panel";
import { useCodeDirectories } from "../directories/use-code-directories";

export function useSessionDirectory() {
  const { session } = useChat();
  const { directories } = useCodeDirectories();
  const directoryId = session.data?.codeDirectoryId ?? null;
  const directory = directories.data?.find((d) => d.id === directoryId) ?? null;
  return {
    directory,
    directoryId,
    runnerId: directory?.runnerId ?? null,
    isPending: session.isPending || directories.isPending,
  };
}
