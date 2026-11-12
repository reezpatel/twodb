import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Database, FileText, Link2, Table2 } from "lucide-react";
import type { BlockEditorHost, Editor, JSONContent, SlashItem } from "@twodb/editor";
import type { RecordDetail } from "@shared/model";
import { api } from "../../lib/api";
import { keys, useGarden } from "../../lib/queries";
import { DatabaseBlock } from "../../database/DatabaseBlock";
import { PageMentionChip } from "../partials/PageMentionChip";

const SAVE_DELAY = 700;

/**
 * Holding hook for a note: autosaves content (debounced, flushed on unmount
 * / tab hide), keeps the record cache in sync so remounts show the latest
 * text, and builds the editor host (mentions, sub-pages, databases, uploads).
 */
export function useDocEditor(record: RecordDetail) {
  const garden = useGarden();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pending = useRef<JSONContent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState<"idle" | "pending" | "saved">("idle");
  const [linkPicker, setLinkPicker] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const id = record.id;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const doc = pending.current;
    if (!doc) return;
    pending.current = null;
    qc.setQueryData(keys.record(id), (old: RecordDetail | undefined) => (old ? { ...old, content: doc as Record<string, unknown> } : old));
    await garden.patchRecord(id, { content: doc as Record<string, unknown> }, { quiet: true });
    setSaving("saved");
    void qc.invalidateQueries({ queryKey: ["backlinks"] });
    void qc.invalidateQueries({ queryKey: ["rows"] }); // previews in list/gallery
  }, [garden, id, qc]);

  const onChange = useCallback(
    (doc: JSONContent) => {
      pending.current = doc;
      setSaving("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
      void flush();
    };
  }, [flush]);

  const host: BlockEditorHost = useMemo(() => {
    const slashItems: SlashItem[] = [
      {
        id: "sub-page",
        group: "Pages",
        title: "Page",
        description: "Nested page inside this one",
        icon: <FileText size={16} />,
        keywords: ["subpage", "child", "new page"],
        run: (editor, range) => {
          editor.chain().focus().deleteRange(range).run();
          void garden.createPage({ parentId: id }).then((p) => {
            editor.chain().focus().insertContent([{ type: "pageMention", attrs: { id: p.id, title: "Untitled" } }, { type: "text", text: " " }]).run();
            navigate(`/${p.id}`);
          });
        },
      },
      {
        id: "database-inline",
        group: "Database",
        title: "Database",
        description: "Inline table, board, calendar…",
        icon: <Table2 size={16} />,
        keywords: ["table", "db", "kanban", "board", "notion"],
        run: (editor, range) => {
          editor.chain().focus().deleteRange(range).run();
          void garden.createDatabase({ parentId: id, inline: true }).then((d) => editor.chain().focus().insertDatabaseView({ databaseId: d.database.id, viewId: d.views[0]?.id }).run());
        },
      },
      {
        id: "database-page",
        group: "Database",
        title: "Database page",
        description: "Full-page database nested here",
        icon: <Database size={16} />,
        keywords: ["db", "fullpage"],
        run: (editor, range) => {
          editor.chain().focus().deleteRange(range).run();
          void garden.createDatabase({ parentId: id }).then((d) => {
            editor.chain().focus().insertContent([{ type: "pageMention", attrs: { id: d.database.id, title: "Untitled database" } }, { type: "text", text: " " }]).run();
            navigate(`/${d.database.id}`);
          });
        },
      },
      {
        id: "linked-view",
        group: "Database",
        title: "Linked view of database",
        description: "Show an existing database here",
        icon: <Link2 size={16} />,
        keywords: ["linked", "embed", "existing"],
        run: (editor, range) => {
          editor.chain().focus().deleteRange(range).run();
          setLinkPicker(editor);
        },
      },
    ];
    return {
      searchPages: async (q) => (await api.search(q, { limit: 8 })).hits.filter((h) => h.id !== id).map((h) => ({ id: h.id, title: h.title || "Untitled", icon: h.icon })),
      createPage: async (title) => {
        const p = await garden.createPage({ parentId: id, title });
        return { id: p.id, title: p.title };
      },
      openPage: (pageId) => navigate(`/${pageId}`),
      uploadImage: async (file) => (await api.upload(file, id)).url,
      slashItems,
      DatabaseBlock,
      PageMention: PageMentionChip,
    };
  }, [garden, id, navigate]);

  return {
    host,
    onChange,
    flush,
    saving,
    linkPicker,
    closeLinkPicker: () => setLinkPicker(null),
    insertLinkedView: async (databaseId: string) => {
      const d = await api.database(databaseId);
      linkPicker?.chain().focus().insertDatabaseView({ databaseId, viewId: d.views[0]?.id }).run();
      setLinkPicker(null);
    },
    editorRef,
  };
}

