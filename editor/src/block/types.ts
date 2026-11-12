import type { Editor, JSONContent, Range } from "@tiptap/core";
import type { ComponentType, ReactNode } from "react";

/** A page reference the host resolves (for @-mentions / [[links]]). */
export interface PageRef {
  id: string;
  title: string;
  icon?: string | null;
}

export interface SlashItem {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  group?: string;
  keywords?: string[];
  run: (editor: Editor, range: Range) => void;
}

/** Props the host's database renderer receives for a `databaseView` block. */
export interface DatabaseBlockProps {
  databaseId: string;
  viewId: string | null;
  editable: boolean;
  /** Persist a different view selection into the block. */
  setViewId: (viewId: string) => void;
  /** Remove the block from the document. */
  remove: () => void;
}

/** Props the host's page-mention renderer receives. */
export interface PageMentionProps {
  id: string;
  /** Title captured when the mention was inserted (fallback). */
  title: string;
}

export interface BlockEditorHost {
  /** Page search for @ / [[ menus. */
  searchPages?: (query: string) => Promise<PageRef[]>;
  /** "Create page" entry in the mention menu. */
  createPage?: (title: string) => Promise<PageRef>;
  /** Click on a page mention. */
  openPage?: (id: string) => void;
  uploadImage?: (file: File) => Promise<string>;
  /** Extra slash items (e.g. Sub-page, Database). */
  slashItems?: SlashItem[];
  /** Renders `databaseView` blocks; without it they show a placeholder. */
  DatabaseBlock?: ComponentType<DatabaseBlockProps>;
  /** Renders page mentions with live titles; defaults to the stored title. */
  PageMention?: ComponentType<PageMentionProps>;
}

export interface BlockEditorProps extends BlockEditorHost {
  /** Initial TipTap JSON. The editor is uncontrolled — remount (key) to load another doc. */
  initialContent: JSONContent | null;
  onChange?: (doc: JSONContent, editor: Editor) => void;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  className?: string;
  /** Called on ArrowUp at the very start of the doc (move focus to the title). */
  onExitTop?: () => void;
  onReady?: (editor: Editor) => void;
}
