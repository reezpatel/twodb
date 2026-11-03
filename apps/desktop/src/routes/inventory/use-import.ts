import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { apiFetch } from "@/lib/native";
import type { ImportResult } from "./inventory-api";
import { inventoryErrorMessage } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";

export function useImport() {
  const inv = useInventoryContext();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fields = useQuery({
    queryKey: ["inventory", "import-fields"],
    queryFn: () => api<{ importFields: { key: string; label: string }[] }>("/api/inventory"),
    select: (d) => d.importFields,
  });

  const run = (dryRun: boolean, nextMapping: Record<string, string> | null) =>
    api<ImportResult>(`/api/inventory/${inv.id}/import`, { method: "POST", body: JSON.stringify({ csv, dryRun, ...(nextMapping ? { mapping: nextMapping } : {}) }) });

  const preview = useMutation({
    mutationFn: (text: string) =>
      api<ImportResult>(`/api/inventory/${inv.id}/import`, { method: "POST", body: JSON.stringify({ csv: text, dryRun: true }) }),
    onSuccess: (r) => {
      setMapping(r.mapping);
      setResult(r);
    },
  });

  const commit = useMutation({
    mutationFn: () => run(false, mapping),
    onSuccess: (r) => {
      setResult(r);
      void inv.items.refetch();
      void inv.locations.refetch();
      void inv.groups.refetch();
      void inv.summary.refetch();
    },
  });

  const load = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setResult(null);
    preview.mutate(text);
  };

  const reset = () => {
    setCsv("");
    setFileName("");
    setMapping(null);
    setResult(null);
    preview.reset();
    commit.reset();
  };

  const committed = commit.isSuccess;
  const error = preview.isError ? inventoryErrorMessage(preview.error) : commit.isError ? inventoryErrorMessage(commit.error) : null;

  return { fields: fields.data ?? [], csv, fileName, mapping, setMapping, result, load, reset, commit, preview, committed, error };
}

export async function downloadItemsCsv(inventoryId: string, name: string) {
  const res = await apiFetch(`/api/inventory/${inventoryId}/export.csv`);
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "_") || "inventory"}-items.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
