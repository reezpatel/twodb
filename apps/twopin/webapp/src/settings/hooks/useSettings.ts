import { useCallback, useEffect, useState } from "react";
import { twopinClient } from "../../lib/twopin-client.js";

/**
 * Holding hook for SettingsPage: loads the app settings and saves the
 * share-target default board.
 */
export function useSettings() {
  const [defaultBoardId, setDefaultBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    twopinClient
      .getSettings()
      .then((s) => {
        if (!cancelled) setDefaultBoardId(s.defaultBoardId);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (boardId: string | null) => {
    setSaving(true);
    setSaved(false);
    try {
      setError(null);
      const s = await twopinClient.updateSettings(boardId);
      setDefaultBoardId(s.defaultBoardId);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  return { defaultBoardId, setDefaultBoardId, loading, saving, error, saved, save };
}

