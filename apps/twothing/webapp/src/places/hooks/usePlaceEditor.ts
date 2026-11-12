import { useEffect, useMemo, useState } from "react";
import { refreshAll } from "../../lib/actions";
import { ApiError, api, errorMessage } from "../../lib/api";
import { displayCode } from "../../lib/format";
import { shrinkImage } from "../../lib/image";
import { useQuery } from "../../lib/query";
import { navigate, useRoute } from "../../lib/router";
import { toast } from "../../lib/toast";
import type { LabelStatus } from "../../items/hooks/useItemEditor";
import { useScanner } from "../../scanner/ScanContext";

interface Draft {
  name: string;
  kind: string;
  parentId: string | null;
  description: string;
  code: string;
  autoCode: boolean;
  imageId: string | null;
}

/** Suggest a sensible kind for a child of `parentKind`. */
const childKind = (parentKind?: string) =>
  ({ room: "shelf", cabinet: "shelf", rack: "shelf", shelf: "box", drawer: "organizer", organizer: "bin" } as Record<string, string>)[parentKind ?? ""] ?? "box";

/** Holding hook for <PlaceEditor>. */
export function usePlaceEditor(id?: string) {
  const { query } = useRoute();
  const scanner = useScanner();
  const places = useQuery("places", api.places);
  const existing = id ? places.data?.locations.find((p) => p.id === id) : undefined;
  const [draft, setDraft] = useState<Draft>({
    name: "",
    kind: "box",
    parentId: query.get("parent"),
    description: "",
    code: query.get("code") ? displayCode(query.get("code")!) : "",
    autoCode: false,
    imageId: null,
  });
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [labelStatus, setLabelStatus] = useState<LabelStatus>({ state: "empty" });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    if (id && existing && !loaded) {
      setDraft({ name: existing.name, kind: existing.kind, parentId: existing.parentId, description: existing.description, code: existing.codeDisplay ?? "", autoCode: false, imageId: existing.imageId });
      setLoaded(true);
    }
  }, [id, existing, loaded]);

  // New child: guess the kind from the parent once places load.
  useEffect(() => {
    if (!id && draft.parentId && places.data) {
      const parent = places.data.locations.find((p) => p.id === draft.parentId);
      setDraft((d) => ({ ...d, kind: childKind(parent?.kind) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!places.data]);

  useEffect(() => {
    const raw = draft.code.trim();
    if (!raw) return setLabelStatus({ state: "empty" });
    setLabelStatus({ state: "checking" });
    const t = setTimeout(async () => {
      const res = await api.resolve(raw).catch(() => null);
      const holder = res?.matches.find((m) => m.type === "location") ?? res?.matches.find((m) => m.type === "item" && m.via === "label");
      if (holder?.type === "location") setLabelStatus(holder.location.id === id ? { state: "mine" } : { state: "taken", by: `place “${holder.location.name}”` });
      else if (holder?.type === "item") setLabelStatus({ state: "taken", by: `item “${holder.item.name}”` });
      else if (res?.matches[0]?.type === "free_code") setLabelStatus({ state: "free", inPool: res.matches[0].inPool });
      else setLabelStatus({ state: "custom" });
    }, 300);
    return () => clearTimeout(t);
  }, [draft.code, id]);

  const parent = useMemo(() => places.data?.locations.find((p) => p.id === draft.parentId), [places.data, draft.parentId]);

  const save = async (andAnother = false) => {
    setError(null);
    if (!draft.name.trim()) return setError("Give it a name.");
    if (labelStatus.state === "taken") return setError(`That label is already on ${labelStatus.by}.`);
    setSaving(true);
    try {
      const body = {
        name: draft.name.trim(),
        kind: draft.kind,
        parentId: draft.parentId,
        description: draft.description,
        code: draft.code.trim() || null,
        autoCode: draft.autoCode && !draft.code.trim(),
        imageId: draft.imageId,
      };
      const saved = id ? await api.updatePlace(id, body) : await api.createPlace(body);
      refreshAll();
      if (andAnother) {
        toast(`Created ${saved.name}${saved.codeDisplay ? ` · ${saved.codeDisplay}` : ""}`, { tone: "success" });
        setDraft((d) => ({ ...d, name: "", description: "", code: "", imageId: null }));
      } else {
        toast(id ? "Saved" : `Created ${saved.name}`, { tone: "success" });
        navigate(`/places/${saved.id}`, { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !existing) return;
    const nonEmpty = existing.childCount > 0 || existing.itemCount > 0;
    const msg = nonEmpty
      ? `Delete “${existing.name}”? Its ${existing.itemCount} item(s) and ${existing.childCount} place(s) move up into ${parent?.name ?? "the top level"}.`
      : `Delete “${existing.name}”?`;
    if (!confirm(msg)) return;
    try {
      await api.deletePlace(id, nonEmpty);
      refreshAll();
      toast("Deleted", { tone: "success" });
      navigate(parent ? `/places/${parent.id}` : "/places", { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? errorMessage(e) : "Delete failed", { tone: "error" });
    }
  };

  return {
    isEdit: !!id,
    loaded: loaded || (!id && true),
    notFound: !!id && !!places.data && !existing,
    draft,
    set,
    parent,
    parentOpen,
    setParentOpen,
    labelStatus,
    scanLabel: async () => {
      const raw = await scanner.pick({ title: "Scan the box label", hint: "Stick a pre-printed label on it and scan" });
      if (raw) {
        const res = await api.resolve(raw).catch(() => null);
        set("code", res?.code ? displayCode(res.code) : raw.trim());
      }
    },
    scanParent: async () => {
      const raw = await scanner.pick({ title: "Scan the parent's label", hint: "Where does this place sit?" });
      if (!raw) return;
      const res = await api.resolve(raw).catch(() => null);
      const loc = res?.matches.find((m) => m.type === "location");
      if (loc?.type === "location" && loc.location.id !== id) set("parentId", loc.location.id);
      else toast("That isn't another place's label.", { tone: "error" });
    },
    addPhoto: async (files: FileList) => {
      const f = files[0];
      if (!f) return;
      setUploading(1);
      try {
        const { id: imageId } = await api.uploadImage(await shrinkImage(f));
        set("imageId", imageId);
      } catch (e) {
        toast(errorMessage(e), { tone: "error" });
      } finally {
        setUploading(0);
      }
    },
    uploading,
    save,
    saving,
    error,
    remove,
  };
}
