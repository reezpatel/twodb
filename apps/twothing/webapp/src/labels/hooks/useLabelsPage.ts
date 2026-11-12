import { useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { invalidate, useQuery } from "../../lib/query";
import { navigate } from "../../lib/router";
import { toast } from "../../lib/toast";
import { layoutById, perPage } from "../layouts";

/** Holding hook for <LabelsPage>: bulk generation + batch history. */
export function useLabelsPage() {
  const { data, loading } = useQuery("batches", api.batches);
  const savedLayout = layoutById(JSON.parse(localStorage.getItem("twothing.print") ?? "{}").layoutId ?? "");
  const sheetSize = perPage(savedLayout) > 1 ? perPage(savedLayout) : 0;
  const [count, setCount] = useState(sheetSize || 50);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const presets = [...new Set([...(sheetSize ? [sheetSize, sheetSize * 2, sheetSize * 4] : []), 24, 50, 100, 200])].sort((a, b) => a - b).slice(0, 6);

  const generate = async () => {
    if (count < 1 || count > 1000) return toast("Between 1 and 1000 labels at a time.", { tone: "error" });
    setBusy(true);
    try {
      const res = await api.generateCodes(count, note.trim() || undefined);
      invalidate("batches");
      setNote("");
      navigate(`/labels/batch/${res.batchId}`);
    } catch (e) {
      toast(errorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
    batches: data?.batches ?? [],
    pool: data?.pool ?? { free: 0, fresh: 0 },
    windowDays: data?.reissueWindowDays ?? 7,
    count,
    setCount,
    note,
    setNote,
    presets,
    sheetSize,
    sheetName: savedLayout.name,
    busy,
    generate,
  };
}
