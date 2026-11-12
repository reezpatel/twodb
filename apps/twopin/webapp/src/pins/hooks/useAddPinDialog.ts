import { useEffect, useState } from "react";
import type { BoardDto, PinDto } from "../../lib/twopin-client.js";
import { useAddPinPreview } from "./useAddPinPreview.js";

interface UseAddPinDialogArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardDto[];
  defaultBoardId: string | undefined;
  onCreatePin: (input: { boardId: string; url: string; note?: string }) => Promise<unknown>;
}

/** Holding hook for AddPinDialog: form state + live preview composition. */
export function useAddPinDialog({ open, onOpenChange, boards, defaultBoardId, onCreatePin }: UseAddPinDialogArgs) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [boardId, setBoardId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useAddPinPreview(url);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setUrl("");
      setNote("");
      setError(null);
      setBoardId(defaultBoardId ?? boards[0]?.id ?? "");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = !!boardId && !!url.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onCreatePin({ boardId, url: url.trim(), note: note.trim() || undefined });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return { url, setUrl, note, setNote, boardId, setBoardId, busy, error, canSubmit, submit, preview };
}
