import { useMemo, useState } from "react";
import type { FinderSelection } from "@/components/use-runner-finder";
import { useCodeDirectories, type CodeDirectory } from "./use-code-directories";

export function useNewDirectoryDialog(onCreated: (dir: CodeDirectory) => void) {
  const [dirName, setDirName] = useState("");
  const [selection, setSelection] = useState<FinderSelection | null>(null);
  const { directories, createDirectory } = useCodeDirectories();

  const existing = useMemo(
    () => (selection ? ((directories.data ?? []).find((d) => d.runnerId === selection.runnerId && d.cwd === selection.path) ?? null) : null),
    [directories.data, selection],
  );

  const submit = () => {
    if (!selection) return;
    createDirectory.mutate(
      { displayName: dirName.trim() || existing?.displayName || "Untitled", cwd: selection.path, runnerId: selection.runnerId },
      {
        onSuccess: (row) => {
          setDirName("");
          setSelection(null);
          onCreated(row);
        },
      },
    );
  };

  return { dirName, setDirName, selection, setSelection, existing, createDirectory, submit };
}
