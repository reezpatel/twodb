import { useEffect, useMemo, useRef, useState } from "react";
import { refreshAll } from "../../lib/actions";
import { api, errorMessage } from "../../lib/api";
import { categoryOf } from "../../lib/catalog";
import { displayCode } from "../../lib/format";
import { shrinkImage } from "../../lib/image";
import { useQuery } from "../../lib/query";
import { navigate, useRoute } from "../../lib/router";
import { toast } from "../../lib/toast";
import type { Item, ItemInput, Place } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

export interface SpecRow {
  key: string;
  value: string;
}

export type LabelStatus =
  | { state: "empty" }
  | { state: "checking" }
  | { state: "free"; inPool: boolean }
  | { state: "mine" }
  | { state: "taken"; by: string }
  | { state: "custom" };

interface Draft {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  minQuantity: string;
  locationId: string | null;
  code: string;
  autoCode: boolean;
  barcodes: string[];
  specs: SpecRow[];
  tags: string[];
  imageIds: string[];
  description: string;
  manufacturer: string;
  mpn: string;
  supplier: string;
  unitCost: string;
  purchaseUrl: string;
  datasheetUrl: string;
  notes: string;
  favorite: boolean;
}

const templateRows = (category: string, existing: SpecRow[] = []): SpecRow[] => {
  const have = new Set(existing.filter((r) => r.key.trim()).map((r) => r.key.toLowerCase()));
  const kept = existing.filter((r) => r.key.trim() || r.value.trim());
  return [...kept, ...categoryOf(category).specs.filter((k) => !have.has(k.toLowerCase())).map((key) => ({ key, value: "" }))];
};

function blank(q: URLSearchParams): Draft {
  const category = q.get("category") ?? localStorage.getItem("twothing.lastCategory") ?? "electronics";
  return {
    name: "",
    category,
    quantity: "1",
    unit: categoryOf(category).units[0] ?? "pcs",
    minQuantity: "",
    locationId: q.get("loc"),
    code: q.get("code") ? displayCode(q.get("code")!) : "",
    autoCode: false,
    barcodes: q.get("barcode") ? [q.get("barcode")!] : [],
    specs: templateRows(category),
    tags: [],
    imageIds: [],
    description: "",
    manufacturer: "",
    mpn: "",
    supplier: "",
    unitCost: "",
    purchaseUrl: "",
    datasheetUrl: "",
    notes: "",
    favorite: false,
  };
}

function fromItem(it: Item): Draft {
  return {
    name: it.name,
    category: it.category,
    quantity: String(it.quantity),
    unit: it.unit,
    minQuantity: it.minQuantity === null ? "" : String(it.minQuantity),
    locationId: it.locationId,
    code: it.codeDisplay ?? "",
    autoCode: false,
    barcodes: it.barcodes,
    specs: templateRows(it.category, Object.entries(it.specs).map(([key, value]) => ({ key, value }))),
    tags: it.tags,
    imageIds: it.imageIds,
    description: it.description,
    manufacturer: it.manufacturer,
    mpn: it.mpn,
    supplier: it.supplier,
    unitCost: it.unitCost === null ? "" : String(it.unitCost),
    purchaseUrl: it.purchaseUrl,
    datasheetUrl: it.datasheetUrl,
    notes: it.notes,
    favorite: it.favorite,
  };
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Holding hook for <ItemEditor> (create + edit). */
export function useItemEditor(id?: string) {
  const { query } = useRoute();
  const scanner = useScanner();
  const existing = useQuery(id ? `item:${id}` : null, () => api.item(id!));
  const places = useQuery("places", api.places);
  const tagsQ = useQuery("tags", api.tags);

  const [draft, setDraft] = useState<Draft>(() => blank(query));
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [labelStatus, setLabelStatus] = useState<LabelStatus>({ state: "empty" });
  const [placeOpen, setPlaceOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const savedCount = useRef(0);

  useEffect(() => {
    if (id && existing.data && !loaded) {
      setDraft(fromItem(existing.data.item));
      setLoaded(true);
      const it = existing.data.item;
      if (it.manufacturer || it.mpn || it.supplier || it.unitCost !== null || it.purchaseUrl || it.datasheetUrl) setMoreOpen(true);
    }
  }, [id, existing.data, loaded]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // ---- live label availability check (debounced)
  useEffect(() => {
    const raw = draft.code.trim();
    if (!raw) return setLabelStatus({ state: "empty" });
    setLabelStatus({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await api.resolve(raw);
        const holder = res.matches.find((m) => m.type === "item" && m.via === "label") ?? res.matches.find((m) => m.type === "location");
        if (holder?.type === "item") setLabelStatus(holder.item.id === id ? { state: "mine" } : { state: "taken", by: `item “${holder.item.name}”` });
        else if (holder?.type === "location") setLabelStatus({ state: "taken", by: `place “${holder.location.name}”` });
        else if (res.matches[0]?.type === "free_code") setLabelStatus({ state: "free", inPool: res.matches[0].inPool });
        else setLabelStatus({ state: "custom" });
      } catch {
        setLabelStatus({ state: "custom" });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft.code, id]);

  const place: Place | undefined = useMemo(() => places.data?.locations.find((p) => p.id === draft.locationId), [places.data, draft.locationId]);

  const setCategory = (c: string) =>
    setDraft((d) => {
      const prevUnits = categoryOf(d.category).units;
      const unit = !d.unit || prevUnits.includes(d.unit) ? (categoryOf(c).units[0] ?? d.unit) : d.unit;
      return { ...d, category: c, unit, specs: templateRows(c, d.specs.filter((r) => r.value.trim() || !categoryOf(d.category).specs.includes(r.key))) };
    });

  // ---- scanning helpers
  const scanLabel = async () => {
    const raw = await scanner.pick({ title: "Scan the label sticker", hint: "Stick a pre-printed label on the item, then scan it" });
    if (raw) {
      const res = await api.resolve(raw).catch(() => null);
      set("code", res?.code ? displayCode(res.code) : raw.trim());
      set("autoCode", false);
    }
  };

  const scanBarcode = async () => {
    const raw = await scanner.pick({ title: "Scan the product's barcode / QR", hint: "EAN, UPC, Code-128, QR on the packaging…" });
    if (!raw) return;
    const res = await api.resolve(raw).catch(() => null);
    if (res?.matches[0]?.type === "free_code") {
      set("code", displayCode(res.matches[0].code));
      toast("That's one of your labels — set it as this item's label.", { tone: "info" });
      return;
    }
    const others = res?.matches.filter((m) => m.type === "item" && m.item.id !== id) ?? [];
    if (others.length && others[0].type === "item") toast(`Note: “${others[0].item.name}” already has this barcode.`, { tone: "info" });
    setDraft((d) => (d.barcodes.includes(raw) ? d : { ...d, barcodes: [...d.barcodes, raw] }));
  };

  const scanPlace = async () => {
    const raw = await scanner.pick({ title: "Scan the box / place label", hint: "Where does this item live?" });
    if (!raw) return;
    const res = await api.resolve(raw).catch(() => null);
    const loc = res?.matches.find((m) => m.type === "location");
    if (loc?.type === "location") set("locationId", loc.location.id);
    else toast("That code isn't a box/place label.", { tone: "error" });
  };

  // ---- photos
  const addPhotos = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 10);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const { id: imageId } = await api.uploadImage(await shrinkImage(f));
        setDraft((d) => ({ ...d, imageIds: [...d.imageIds, imageId] }));
      } catch (e) {
        toast(`Upload failed: ${errorMessage(e)}`, { tone: "error" });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const removePhoto = (imageId: string) => set("imageIds", draft.imageIds.filter((x) => x !== imageId));
  const makeCover = (imageId: string) => set("imageIds", [imageId, ...draft.imageIds.filter((x) => x !== imageId)]);

  // ---- tags
  const addTag = (t: string) => {
    const tag = t.trim().replace(/,$/, "");
    if (tag && !draft.tags.includes(tag)) set("tags", [...draft.tags, tag]);
    setTagInput("");
  };
  const tagSuggestions = useMemo(() => {
    const used = new Set(draft.tags.map((t) => t.toLowerCase()));
    const fromDb = (tagsQ.data?.tags ?? []).map((t) => t.tag);
    const all = [...new Set([...categoryOf(draft.category).tags, ...fromDb])].filter((t) => !used.has(t.toLowerCase()));
    const q = tagInput.toLowerCase();
    return (q ? all.filter((t) => t.toLowerCase().includes(q)) : all).slice(0, 12);
  }, [tagsQ.data, draft.tags, draft.category, tagInput]);

  // ---- save
  const payload = (): ItemInput => ({
    name: draft.name.trim(),
    category: draft.category,
    quantity: num(draft.quantity) ?? 0,
    unit: draft.unit.trim() || "pcs",
    minQuantity: num(draft.minQuantity),
    locationId: draft.locationId,
    code: draft.code.trim() || null,
    autoCode: draft.autoCode && !draft.code.trim(),
    barcodes: draft.barcodes,
    specs: Object.fromEntries(draft.specs.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value.trim()])),
    tags: draft.tags,
    imageIds: draft.imageIds,
    description: draft.description,
    manufacturer: draft.manufacturer,
    mpn: draft.mpn,
    supplier: draft.supplier,
    unitCost: num(draft.unitCost),
    purchaseUrl: draft.purchaseUrl,
    datasheetUrl: draft.datasheetUrl,
    notes: draft.notes,
    favorite: draft.favorite,
  });

  const save = async (andAnother = false) => {
    setError(null);
    if (!draft.name.trim()) {
      setError("Give it a name.");
      nameRef.current?.focus();
      return;
    }
    if (labelStatus.state === "taken") {
      setError(`That label is already on ${labelStatus.by}.`);
      return;
    }
    for (const [k, label] of [["quantity", "Quantity"], ["minQuantity", "Min stock"], ["unitCost", "Unit cost"]] as const) {
      const v = num(draft[k]);
      if (v !== null && (Number.isNaN(v) || v < 0)) return setError(`${label} must be a positive number.`);
    }
    setSaving(true);
    try {
      const saved = id ? await api.updateItem(id, { ...payload(), autoCode: draft.autoCode && !draft.code.trim() }) : await api.createItem(payload());
      localStorage.setItem("twothing.lastCategory", draft.category);
      refreshAll();
      if (andAnother && !id) {
        savedCount.current++;
        toast(`Added “${saved.name}”${saved.codeDisplay ? ` · ${saved.codeDisplay}` : ""}`, { tone: "success", action: { label: "View", run: () => navigate(`/items/${saved.id}`) } });
        // Keep the context (where + what kind) for fast batch entry.
        setDraft((d) => ({ ...blank(new URLSearchParams()), category: d.category, unit: d.unit, locationId: d.locationId, tags: d.tags, specs: templateRows(d.category), autoCode: d.autoCode }));
        setTimeout(() => nameRef.current?.focus(), 30);
      } else {
        toast(id ? "Saved" : `Added “${saved.name}”${saved.codeDisplay ? ` · label ${saved.codeDisplay}` : ""}`, { tone: "success" });
        navigate(`/items/${saved.id}`, { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm(`Delete “${draft.name}”? This can't be undone.`)) return;
    await api.deleteItem(id);
    refreshAll();
    toast("Deleted", { tone: "success" });
    navigate("/items", { replace: true });
  };

  return {
    isEdit: !!id,
    loaded,
    notFound: !!id && !!existing.error,
    draft,
    set,
    setCategory,
    nameRef,
    labelStatus,
    scanLabel,
    scanBarcode,
    scanPlace,
    place,
    placeOpen,
    setPlaceOpen,
    addPhotos,
    removePhoto,
    makeCover,
    uploading,
    tagInput,
    setTagInput,
    addTag,
    removeTag: (t: string) => set("tags", draft.tags.filter((x) => x !== t)),
    tagSuggestions,
    setSpec: (i: number, row: SpecRow) => set("specs", draft.specs.map((r, j) => (j === i ? row : r))),
    addSpec: () => set("specs", [...draft.specs, { key: "", value: "" }]),
    removeSpec: (i: number) => set("specs", draft.specs.filter((_, j) => j !== i)),
    removeBarcode: (b: string) => set("barcodes", draft.barcodes.filter((x) => x !== b)),
    addBarcode: (b: string) => b.trim() && !draft.barcodes.includes(b.trim()) && set("barcodes", [...draft.barcodes, b.trim()]),
    moreOpen,
    setMoreOpen,
    save,
    saving,
    error,
    remove,
  };
}
