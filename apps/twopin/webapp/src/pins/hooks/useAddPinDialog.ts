import { useEffect, useRef, useState } from "react";
import type { BoardDto } from "../../lib/twopin-client.js";
import { fileToBase64 } from "../../lib/twopin-client.js";
import { useAddPinPreview } from "./useAddPinPreview.js";

export interface CreatePinInput {
  boardId: string;
  url?: string | null;
  note?: string;
  title?: string;
  mediaBase64?: string;
  mediaContentType?: string;
  tags?: string[];
}

interface UseAddPinDialogArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardDto[];
  defaultBoardId: string | undefined;
  onCreatePin: (input: CreatePinInput) => Promise<unknown>;
}

type Mode = "link" | "upload";

/** Holding hook for AddPinDialog: link or media-upload modes + form state. */
export function useAddPinDialog({ open, onOpenChange, boards, defaultBoardId, onCreatePin }: UseAddPinDialogArgs) {
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useAddPinPreview(url);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setMode("link");
      setUrl("");
      setNote("");
      setTitle("");
      setFile(null);
      setTags([]);
      setError(null);
      setBoardId(defaultBoardId ?? boards[0]?.id ?? "");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = !!boardId && !busy && (mode === "link" ? !!url.trim() : !!file);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "upload" && file) {
        const mediaBase64 = await fileToBase64(file);
        await onCreatePin({
          boardId,
          title: title.trim() || file.name,
          note: note.trim() || undefined,
          mediaBase64,
          mediaContentType: file.type,
          tags: tags.length ? tags : undefined,
        });
      } else {
        await onCreatePin({ boardId, url: url.trim(), note: note.trim() || undefined, tags: tags.length ? tags : undefined });
      }
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return {
    mode,
    setMode,
    url,
    setUrl,
    note,
    setNote,
    title,
    setTitle,
    boardId,
    setBoardId,
    file,
    setFile,
    fileRef,
    tags,
    setTags,
    busy,
    error,
    canSubmit,
    submit,
    preview,
  };
}

