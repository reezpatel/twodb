import { useEffect, useState } from "react";
import type { BoardDto, PinDto } from "../../lib/twopin-client.js";

interface UseEditPinDialogArgs {
  pin: PinDto | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null }) => Promise<unknown>;
}

/** Holding hook for EditPinDialog: form state seeded from the pin. */
export function useEditPinDialog({ pin, onOpenChange, onSave }: UseEditPinDialogArgs) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [boardId, setBoardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pin) {
      setTitle(pin.title ?? "");
      setDescription(pin.description ?? "");
      setNote(pin.note ?? "");
      setBoardId(pin.boardId);
      setError(null);
    }
  }, [pin]);

  const save = async () => {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(pin.id, {
        boardId: boardId !== pin.boardId ? boardId : undefined,
        title: title.trim() || null,
        description: description.trim() || null,
        note: note.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return { title, setTitle, description, setDescription, note, setNote, boardId, setBoardId, busy, error, save };
}
