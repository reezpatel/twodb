import { useEffect, useId } from "react";
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
import { IconButton } from "./IconButton";
import { markdownEditorStyles } from "./MarkdownEditor.style";

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
	id?: string;
}

export function MarkdownEditor({
	value,
	defaultValue,
	onChange,
	placeholder = "Start writing…",
	label,
	hint,
	error,
	minHeight = 140,
	readOnly = false,
	hideToolbar = false,
	id,
}: MarkdownEditorProps) {
	const autoId = useId();
	const editorId = id ?? autoId;
	const labelId = `${editorId}-label`;

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
			Placeholder.configure({ placeholder }),
		],
		content: value ?? defaultValue ?? "",
		contentType: "markdown",
		editable: !readOnly,
		shouldRerenderOnTransaction: true,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getMarkdown());
		},
	});

	/* controlled sync: external value replaces content when it diverges */
	useEffect(() => {
		if (!editor || value === undefined) return;
		if (value !== editor.getMarkdown()) {
			editor.commands.setContent(value, { contentType: "markdown" });
		}
	}, [editor, value]);

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

	const surface = (
		<div
			className={[
				"tw-editor",
				error ? "tw-editor--error" : "",
				readOnly ? "tw-editor--readonly" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<style jsx>{markdownEditorStyles}</style>
			{editor && !readOnly && !hideToolbar ? (
				<div
					className="tw-editor__toolbar"
					role="toolbar"
					aria-label="Formatting"
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
			<EditorContent
				editor={editor}
				id={editorId}
				className="tw-editor__content"
				style={{ minHeight }}
				aria-labelledby={label ? labelId : undefined}
			/>
		</div>
	);

	if (!label && !hint && !error) return surface;

	return (
		<div className="tw-field">
			<style jsx>{markdownEditorStyles}</style>
			{label ? (
				<span className="tw-field__label" id={labelId}>
					{label}
				</span>
			) : null}
			{surface}
			{error ? (
				<span className="tw-field__error" role="alert">
					{error}
				</span>
			) : hint ? (
				<span className="tw-field__hint">{hint}</span>
			) : null}
		</div>
	);
}
