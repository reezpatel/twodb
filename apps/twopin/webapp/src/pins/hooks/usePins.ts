import { useCallback, useEffect, useState } from "react";
import { twopinClient, type PinDto } from "../../lib/twopin-client.js";

/** Business hook: pins for the selected board (undefined = all boards). */
export function usePins(boardId: string | undefined) {
  const [pins, setPins] = useState<PinDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setPins(await twopinClient.listPins(boardId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsert = useCallback((pin: PinDto) => {
    setPins((prev) => {
      const idx = prev.findIndex((p) => p.id === pin.id);
      // A pin moved to another board drops out of a filtered view.
      if (boardId && pin.boardId !== boardId) return prev.filter((p) => p.id !== pin.id);
      if (idx === -1) return [pin, ...prev];
      const next = [...prev];
      next[idx] = pin;
      return next;
    });
  }, [boardId]);

  const createPin = useCallback(
    async (input: { boardId: string; url: string; note?: string }) => {
      const pin = await twopinClient.createPin(input);
      upsert(pin);
      return pin;
    },
    [upsert],
  );

  const updatePin = useCallback(
    async (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null }) => {
      const pin = await twopinClient.updatePin(id, patch);
      upsert(pin);
      return pin;
    },
    [upsert],
  );

  const refreshPin = useCallback(
    async (id: string) => {
      const pin = await twopinClient.refreshPin(id);
      upsert(pin);
      return pin;
    },
    [upsert],
  );

  const deletePin = useCallback(async (id: string) => {
    await twopinClient.deletePin(id);
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { pins, loading, error, reload, createPin, updatePin, refreshPin, deletePin };
}
