import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import Link from "@tiptap/extension-link";
import {
	Table,
	TableRow,
	TableCell,
	TableHeader,
} from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { DragHandle } from "@tiptap/extension-drag-handle";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List,
	ListOrdered,
	Minus,
	Quote,
	Redo2,
	SquareCode,
	Strikethrough,
	Undo2,
} from "lucide-react";
import { markdownEditorStyles } from "./markdown-editor.style";
import { IconButton } from "../icon-button";
import { CustomBlock } from "./custom-block";
import { MapBlock } from "./map-block";
import { defaultSlashItems, SlashMenu, type SlashMenuItem } from "./slash-menu";
import { useKeyboardDock } from "./use-keyboard-dock.hook";

export interface MarkdownEditorProps {
	/** Controlled markdown value. */
	value?: string;
	/** Initial markdown when uncontrolled. */
	defaultValue?: string;
	onChange?: (markdown: string) => void;
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	minHeight?: number;
	readOnly?: boolean;
	/** Focus mode: stay editable but hide the formatting toolbar. */
	hideToolbar?: boolean;
	/** Extra slash-command entries (appended after the built-ins). */
	slashItems?: SlashMenuItem[];
	/** Custom component renderers for ::name{…} blocks and slash items. */
	components?: Record<string, ComponentType<Record<string, unknown>>>;
	id?: string;
}

export function MarkdownEditor({
	value,
	defaultValue,
	onChange,
	placeholder = "Start writing…",
	error,
	minHeight = 140,
	readOnly = false,
	hideToolbar = false,
	slashItems,
	components,
	id,
}: MarkdownEditorProps) {
	const autoId = useId();
	const editorId = id ?? autoId;
	const rootRef = useRef<HTMLDivElement>(null);
	const [focused, setFocused] = useState(false);

	const allComponents = { map: MapBlock, ...components };

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: false,
			}),
			Link.configure({ openOnClick: false }),
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			Image,
			Markdown,
			CustomBlock.configure({ components: allComponents }),
			DragHandle.configure({
				render: () => {
					const el = document.createElement("button");
					el.type = "button";
					el.className = "tw-draghandle";
					el.setAttribute("aria-label", "Drag block to reorder");
					el.innerHTML =
						'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
					return el;
				},
				// TEMP debug: tracing the reported can't-drag issue in real browsers.
				onElementDragStart: () => console.log("[drag-handle] dragstart"),
				onElementDragEnd: () => console.log("[drag-handle] dragend"),
				onNodeChange: ({ node }) =>
					console.log("[drag-handle] hover", node?.type.name ?? null),
			}),
			Placeholder.configure({ placeholder }),
		],
		content: value ?? defaultValue ?? "",
		contentType: "markdown",
		editable: !readOnly,
		shouldRerenderOnTransaction: true,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getMarkdown());
		},
		onFocus: () => setFocused(true),
		onBlur: () => setFocused(false),
	});

	// Toolbar lives at the bottom; on mobile it docks above the keyboard.
	const dock = useKeyboardDock(focused && !readOnly && !hideToolbar, rootRef);
	const menuItems = defaultSlashItems(allComponents).concat(slashItems ?? []);

	/* controlled sync: external value replaces content when it diverges */
	useEffect(() => {
		if (!editor || value === undefined) return;
		if (value !== editor.getMarkdown()) {
			editor.commands.setContent(value, { contentType: "markdown" });
		}
	}, [editor, value]);

	// TEMP debug: does ProseMirror's drop handler consume the drop?
	// (dragging goes true at dragstart; PM nulls it in its drop handler.)
	useEffect(() => {
		if (!editor) return;
		const dom = editor.view.dom;
		const onDrop = () =>
			console.log("[drag-handle] drop on editor", {
				draggingAfterPmHandlers: !!editor.view.dragging,
			});
		dom.addEventListener("drop", onDrop);
		// Capture-phase probe: evaluates PM's own guard conditions *before*
		// PM's bubble listener runs (eventBelongsToView / runCustomHandler).
		const onDropProbe = (e: globalThis.DragEvent) =>
			console.log("[drag-handle] drop probe", {
				defaultPreventedAtEntry: e.defaultPrevented,
				targetInsideViewDom: dom.contains(e.target as Node),
				target: (e.target as HTMLElement | null)?.className
					?.toString()
					.slice(0, 60),
				editable: editor.view.editable,
				dragging: !!editor.view.dragging,
			});
		dom.addEventListener("drop", onDropProbe, true);
		let dragoverLogged = false;
		const onDragOver = () => {
			if (dragoverLogged) return;
			dragoverLogged = true;
			console.log("[drag-handle] dragover reached editor");
		};
		dom.addEventListener("dragover", onDragOver);
		// The extension's drag handler calls dataTransfer.clearData() without
		// ever calling setData — browsers abort a drag with an empty data
		// store immediately after dragstart (no dragover/drop/dragend follow).
		// This bubble-phase document listener runs *after* the extension's
		// element handler within the same event dispatch, so the seed survives.
		const onDragStart = (e: globalThis.DragEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target?.classList?.contains("tw-draghandle")) return;
			e.dataTransfer?.setData("text/plain", "twodb-block-drag");
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		};
		document.addEventListener("dragstart", onDragStart);
		return () => {
			dom.removeEventListener("drop", onDrop);
			dom.removeEventListener("drop", onDropProbe, true);
			dom.removeEventListener("dragover", onDragOver);
			document.removeEventListener("dragstart", onDragStart);
		};
	}, [editor]);

	useEffect(() => {
		if (editor) editor.setEditable(!readOnly);
	}, [editor, readOnly]);

	type Tool =
		| { key: string; sep: true }
		| {
				key: string;
				label: string;
				icon: React.ReactNode;
				active?: () => boolean;
				run: () => void;
				disabled?: () => boolean;
		  };

	const tools: Tool[] = editor
		? [
				{
					key: "bold",
					label: "Bold",
					icon: <Bold />,
					active: () => editor.isActive("bold"),
					run: () => editor.chain().focus().toggleBold().run(),
				},
				{
					key: "italic",
					label: "Italic",
					icon: <Italic />,
					active: () => editor.isActive("italic"),
					run: () => editor.chain().focus().toggleItalic().run(),
				},
				{
					key: "strike",
					label: "Strikethrough",
					icon: <Strikethrough />,
					active: () => editor.isActive("strike"),
					run: () => editor.chain().focus().toggleStrike().run(),
				},
				{
					key: "code",
					label: "Inline code",
					icon: <Code />,
					active: () => editor.isActive("code"),
					run: () => editor.chain().focus().toggleCode().run(),
				},
				{ key: "sep-1", sep: true },
				{
					key: "h1",
					label: "Heading 1",
					icon: <Heading1 />,
					active: () => editor.isActive("heading", { level: 1 }),
					run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
				},
				{
					key: "h2",
					label: "Heading 2",
					icon: <Heading2 />,
					active: () => editor.isActive("heading", { level: 2 }),
					run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
				},
				{
					key: "h3",
					label: "Heading 3",
					icon: <Heading3 />,
					active: () => editor.isActive("heading", { level: 3 }),
					run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
				},
				{ key: "sep-2", sep: true },
				{
					key: "bullet",
					label: "Bullet list",
					icon: <List />,
					active: () => editor.isActive("bulletList"),
					run: () => editor.chain().focus().toggleBulletList().run(),
				},
				{
					key: "ordered",
					label: "Numbered list",
					icon: <ListOrdered />,
					active: () => editor.isActive("orderedList"),
					run: () => editor.chain().focus().toggleOrderedList().run(),
				},
				{
					key: "quote",
					label: "Quote",
					icon: <Quote />,
					active: () => editor.isActive("blockquote"),
					run: () => editor.chain().focus().toggleBlockquote().run(),
				},
				{
					key: "codeblock",
					label: "Code block",
					icon: <SquareCode />,
					active: () => editor.isActive("codeBlock"),
					run: () => editor.chain().focus().toggleCodeBlock().run(),
				},
				{
					key: "hr",
					label: "Divider",
					icon: <Minus />,
					run: () => editor.chain().focus().setHorizontalRule().run(),
				},
				{ key: "sep-3", sep: true },
				{
					key: "undo",
					label: "Undo",
					icon: <Undo2 />,
					run: () => editor.chain().focus().undo().run(),
					disabled: () => !editor.can().undo(),
				},
				{
					key: "redo",
					label: "Redo",
					icon: <Redo2 />,
					run: () => editor.chain().focus().redo().run(),
					disabled: () => !editor.can().redo(),
				},
			]
		: [];

	return (
		<div
			ref={rootRef}
			className={[
				"tw-editor",
				error ? "tw-editor--error" : "",
				readOnly ? "tw-editor--readonly" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{/* Host wrapper owns the scoped class — styled-jsx hashes elements
          written here, not the className passed into EditorContent. */}
			<div
				className="tw-editor__content"
				style={{ minHeight }}
				onClick={(e) => {
					if (readOnly) return;
					if ((e.target as HTMLElement).closest(".ProseMirror")) return;
					editor?.commands.focus("end");
				}}
			>
				<EditorContent
					editor={editor}
					id={editorId}
					className="tw-editor__surface"
				/>
			</div>
			{editor && !readOnly && !hideToolbar ? (
				<div
					className={`tw-editor__toolbar${dock ? " tw-editor__toolbar--docked" : ""}`}
					style={dock ?? undefined}
					role="toolbar"
					aria-label="Formatting"
					onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
				>
					{tools.map((t) =>
						"sep" in t ? (
							<span key={t.key} className="tw-editor__sep" />
						) : (
							<IconButton
								key={t.key}
								size="sm"
								label={t.label}
								icon={t.icon}
								className={t.active?.() ? "is-active" : ""}
								disabled={t.disabled?.()}
								onClick={t.run}
							/>
						),
					)}
				</div>
			) : null}
			{editor && !readOnly ? (
				<SlashMenu editor={editor} items={menuItems} />
			) : null}
			<style jsx>{markdownEditorStyles}</style>
		</div>
	);
}
