import type { Editor } from "@tiptap/core";
import {
	Code,
	Heading1,
	Heading2,
	Heading3,
	Image as ImageIcon,
	List,
	ListOrdered,
	Map as MapIcon,
	Minus,
	Quote,
	SquareCode,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { slashMenuStyles } from "./slash-menu.style";

export interface SlashMenuItem {
	id: string;
	label: string;
	hint?: string;
	icon?: ReactNode;
	keywords?: string[];
	/** Run after the "/query" text has been deleted. */
	run: (editor: Editor) => void;
}

type SlashState = { from: number; query: string; left: number; top: number };

/** Active when the text before the caret ends in `/query` (block start or after space). */
function getSlashState(editor: Editor): { from: number; query: string } | null {
	const { $from, empty } = editor.state.selection;
	if (!empty || !$from.parent.isTextblock) return null;
	if ($from.parent.type.name === "codeBlock") return null;
	const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\0", "");
	const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
	if (!match) return null;
	const query = match[1];
	return { from: $from.pos - query.length - 1, query };
}

function humanize(name: string): string {
	return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultSlashItems(
	components: Record<string, ComponentType<Record<string, unknown>>>,
): SlashMenuItem[] {
	const items: SlashMenuItem[] = [
		{
			id: "h1",
			label: "Heading 1",
			keywords: ["title", "h1"],
			icon: <Heading1 size={14} />,
			run: (e) => e.chain().focus().setNode("heading", { level: 1 }).run(),
		},
		{
			id: "h2",
			label: "Heading 2",
			keywords: ["subtitle", "h2"],
			icon: <Heading2 size={14} />,
			run: (e) => e.chain().focus().setNode("heading", { level: 2 }).run(),
		},
		{
			id: "h3",
			label: "Heading 3",
			keywords: ["h3"],
			icon: <Heading3 size={14} />,
			run: (e) => e.chain().focus().setNode("heading", { level: 3 }).run(),
		},
		{
			id: "bullet",
			label: "Bullet list",
			keywords: ["ul", "points"],
			icon: <List size={14} />,
			run: (e) => e.chain().focus().toggleBulletList().run(),
		},
		{
			id: "ordered",
			label: "Numbered list",
			keywords: ["ol"],
			icon: <ListOrdered size={14} />,
			run: (e) => e.chain().focus().toggleOrderedList().run(),
		},
		{
			id: "quote",
			label: "Quote",
			icon: <Quote size={14} />,
			run: (e) => e.chain().focus().toggleBlockquote().run(),
		},
		{
			id: "codeblock",
			label: "Code block",
			keywords: ["pre"],
			icon: <SquareCode size={14} />,
			run: (e) => e.chain().focus().toggleCodeBlock().run(),
		},
		{
			id: "divider",
			label: "Divider",
			keywords: ["hr", "rule"],
			icon: <Minus size={14} />,
			run: (e) => e.chain().focus().setHorizontalRule().run(),
		},
		{
			id: "image",
			label: "Image",
			keywords: ["picture", "photo"],
			icon: <ImageIcon size={14} />,
			run: (e) => {
				const src = window.prompt("Image URL");
				if (src?.trim()) e.chain().focus().setImage({ src: src.trim() }).run();
			},
		},
		{
			id: "map",
			label: "Map",
			keywords: ["location", "place"],
			icon: <MapIcon size={14} />,
			run: (e) => e.commands.insertCustomBlock({ name: "map" }),
		},
	];
	// One slash item per registered custom component (built-ins above win).
	for (const name of Object.keys(components)) {
		if (items.some((i) => i.id === name)) continue;
		items.push({
			id: name,
			label: humanize(name),
			keywords: [name, "component"],
			icon: <Code size={14} />,
			run: (e) => e.commands.insertCustomBlock({ name }),
		});
	}
	return items;
}

export function SlashMenu({
	editor,
	items,
}: {
	editor: Editor;
	items: SlashMenuItem[];
}) {
	const [state, setState] = useState<SlashState | null>(null);
	const [index, setIndex] = useState(0);

	// Track the "/query" trigger on every transaction.
	useEffect(() => {
		const update = () => {
			const s = getSlashState(editor);
			if (!s) {
				setState(null);
				return;
			}
			const root = editor.view.dom.closest(".tw-editor");
			const rootRect = root?.getBoundingClientRect();
			const coords = editor.view.coordsAtPos(s.from);
			setState({
				...s,
				left: coords.left - (rootRect?.left ?? 0),
				top: coords.bottom - (rootRect?.top ?? 0) + 4,
			});
			setIndex(0);
		};
		const close = () => setState(null);
		editor.on("transaction", update);
		editor.on("blur", close);
		return () => {
			editor.off("transaction", update);
			editor.off("blur", close);
		};
	}, [editor]);

	const query = state?.query.toLowerCase() ?? "";
	const filtered = state
		? items.filter(
				(item) =>
					item.label.toLowerCase().includes(query) ||
					item.keywords?.some((k) => k.includes(query)),
			)
		: [];
	const active = filtered.length > 0 ? filtered[index % filtered.length] : null;

	// Arrow/Enter/Escape handling — capture phase so ProseMirror never sees it.
	useEffect(() => {
		if (!state) return;
		const dom = editor.view.dom;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				setIndex((i) => i + 1);
			} else if (e.key === "ArrowUp") {
				setIndex((i) => Math.max(0, i - 1));
			} else if (e.key === "Enter" && active) {
				pick(active);
			} else if (e.key === "Escape") {
				setState(null);
			} else {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
		};
		dom.addEventListener("keydown", onKeyDown, true);
		return () => dom.removeEventListener("keydown", onKeyDown, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state, active]);

	const pick = (item: SlashMenuItem) => {
		if (!state) return;
		editor
			.chain()
			.focus()
			.deleteRange({ from: state.from, to: editor.state.selection.from })
			.run();
		item.run(editor);
		setState(null);
	};

	if (!state || filtered.length === 0) return null;

	return (
		<div
			className="tw-slash"
			style={{ left: state.left, top: state.top }}
			role="listbox"
			onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
		>
			<style jsx>{slashMenuStyles}</style>
			{filtered.map((item, i) => (
				<button
					key={item.id}
					type="button"
					role="option"
					aria-selected={i === index % filtered.length}
					className={`tw-slash__item${i === index % filtered.length ? " is-active" : ""}`}
					onMouseEnter={() => setIndex(i)}
					onClick={() => pick(item)}
				>
					<span className="tw-slash__icon">{item.icon}</span>
					<span className="tw-slash__label">{item.label}</span>
					{item.hint && <span className="tw-slash__hint">{item.hint}</span>}
				</button>
			))}
		</div>
	);
}
